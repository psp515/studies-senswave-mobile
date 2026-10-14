# Transport abstraction: REST, gRPC-Web and native gRPC

Date: 2026-10-14
Status: approved design, awaiting implementation plan

## Goal

The Senswave backend exposes the same API over three transports, selected per deployment
by `Transport:Mode` = `Rest` | `Grpc` | `GrpcWeb`. The mobile app currently speaks REST only,
through `HttpClientProvider` and 53 call sites with inline path strings.

This design makes the app transport-agnostic. All application code calls typed clients
generated from the backend proto files. One `Transport` implementation is chosen at startup
(or at runtime in development) and injected through a React context. Cross-cutting concerns
(auth, token refresh, consent handling, timeouts, error normalisation, OpenTelemetry) are
implemented once as interceptors that apply to every transport.

The app is Android-only for the native gRPC mode. iOS behaviour in that mode is not a goal.

## Backend facts this design depends on

Source: `E:\Projects\studies-senswave-backend` (Senswave.sln).

- Protos live in `src/Shared/Senswave.Contracts/Protos/**`, proto3, packages `senswave.<module>.v1`.
  Services: AutomationsService, DataSourcesService, DashboardsService, DevicesService,
  OperationsService, devices.v1.SharingService, WidgetsService, HomesService, RoomsService,
  homes.v1.SharingService, LiveUpdatesService, AccountService, AuthService, LegalService, UsersService.
- Only unary and server-streaming RPCs exist. `LiveUpdatesService.Subscribe` is the only stream.
- `Transport:Mode` is exclusive at runtime. In `Grpc` and `GrpcWeb` modes the backend maps
  no REST module routes, no SignalR hub and no Identity `api/v1/auth` endpoints. `GrpcWeb` is
  `Grpc` plus the gRPC-Web middleware, so native gRPC (HTTP/2) also works in `GrpcWeb` mode.
- All transports share one port. Kestrel runs `Http1AndHttp2`; HTTPS only in Docker (self-signed pfx).
- Auth is identical in all modes: `authorization: Bearer <opaque Identity token>`.
- gRPC errors: `RpcException` with trailers `senswave-errors-bin` (repeated serialized
  `common.v1.Error`) and `senswave-trace-id`. Missing consents → `PermissionDenied`.
- REST errors: JSON `ErrorProblemDetails { statusCode, title, type, errors: Error[], traceId }`.
  Missing consents → HTTP 403.
- REST DTOs are hand-written and frozen. They are semantically parallel to the proto messages
  but differ in shape (camelCase JSON, `IdResponse` for creates, empty messages instead of 204,
  `google.protobuf.Struct` for free-form JSON, `optional int32 page/size` pagination).
- `GET api/version` is plain HTTP in every mode and has no gRPC equivalent.
- OpenTelemetry is enabled on the backend (OTLP exporter, AlwaysOn sampler, resource attribute
  `senswave.transport`, ASP.NET Core instrumentation extracts W3C `traceparent`).
- `AuthService` has no Google login RPC. Google login stays REST-only (see Out of scope).

## Decisions taken during brainstorming

| Topic | Decision |
|---|---|
| Native gRPC on mobile | Android only, via a local Expo module wrapping `grpc-okhttp`. No iOS support. |
| gRPC-Web wire format | Binary proto (`application/grpc-web+proto`). |
| Mode selection | `EXPO_PUBLIC_TRANSPORT_MODE` env default; runtime override only when `EXPO_PUBLIC_ENVIRONMENT=Development` (same rule as URL override). Session is logged out when URL or mode changes (logout on change — implemented in PR 8). |
| Scope | One spec covering data endpoints, auth, legal, live updates. Phased PR stack. |
| Measurement | OpenTelemetry client spans with request/response byte attributes, W3C propagation, OTLP/HTTP export, opt-in by env var. |
| Approach | Generated Connect clients as the single app API; transport swapped underneath (approach 2). |

## Architecture

```
contexts / routes / components
        │  api.homes.getHome({ id })    typed, generated, transport-agnostic
        ▼
Connect clients  (createClient(ServiceDesc, transport), generated from proto)
        │
        ▼
Interceptor chain (shared)            otel → timeout → auth → legal → errors
        │
        ▼
Transport (one instance, chosen at startup)
   ├─ RestTransport        mapping table → fetch JSON
   ├─ GrpcWebTransport     @connectrpc/connect-web → fetch, binary proto
   └─ NativeGrpcTransport  Expo module `senswave-grpc` → grpc-okhttp over HTTP/2
```

Everything above the transport is written once. Only the transport differs per mode.

## Section 1 — Codegen, layout, mode selection

### Proto sync and codegen

- `proto/` in the app repo mirrors `src/Shared/Senswave.Contracts/Protos/` from the backend.
  `npm run proto:sync` copies from the directory named by `SENSWAVE_BACKEND_PROTO_DIR` in `.env`.
  The copy is committed so the app builds without a backend checkout.
- `buf.yaml` + `buf.gen.yaml` run `@bufbuild/protoc-gen-es` v2 with `target=ts`,
  `json_types=false`. Output goes to `src/api/gen/` and is committed. `npm run proto:gen`.
- Dependencies: `@bufbuild/protobuf`, `@connectrpc/connect`, `@connectrpc/connect-web`.
  Dev dependencies: `@bufbuild/buf`, `@bufbuild/protoc-gen-es`.

### Layout

```
src/api/
  gen/                      generated code (committed)
  transport/
    TransportMode.ts        type TransportMode = "Rest" | "Grpc" | "GrpcWeb"
    createTransport.ts      (mode, baseUrl, options) → Transport
    rest/                   RestTransport + one mapping file per module
    grpcWeb/                createGrpcWebTransport wrapper + fetch polyfill setup
    nativeGrpc/             Transport implemented over the Expo module
  interceptors/             auth, refresh, legal, timeout, otel, errors
  liveUpdates/              LiveUpdateSource interface + two implementations
  clients.ts                createClient() per service, typed bag
  errors.ts                 ApiError
  polyfills.ts              ReadableStream / TextEncoder / streaming fetch
modules/senswave-grpc/      local Expo module, Kotlin only
```

### Mode selection

- `EXPO_PUBLIC_TRANSPORT_MODE` provides the default. Unset means `Rest`.
- `ConfigurationProvider` gains `transportMode` and `overrideTransportMode(mode)`. The override
  works only in development, is persisted with AsyncStorage next to the URL override, and is
  exposed as a `HorizontalSelector` on `server.tsx`.
- Changing mode or base URL rebuilds the transport and clients (new `ApiProvider` value) and
  logs the session out, because tokens are not portable across backend deployments.
  Changing mode/URL logs out — implemented in PR 8.

### ApiProvider

`ApiProvider` replaces `HttpClientProvider` in `src/app/_layout.tsx`. Provider order becomes
Configuration > Session > Api > LiveUpdate. `useApi()` returns:

```ts
{
  homes, rooms, homeSharing,
  devices, dashboards, operations, widgets, deviceSharing,
  automations, dataSources,
  users, account, auth, legal,
  liveUpdates: LiveUpdateSource,
  transportMode: TransportMode,          // effective (Rest after fallback)
  requestedTransportMode: TransportMode, // from configuration
}
```

## Section 2 — Transports

Connect's `Transport` interface has `unary(...)` and `stream(...)`. Three implementations.

### 2a RestTransport (`transport/rest/`)

Mapping table, one file per module, keyed by RPC name so TypeScript fails when a row is missing:

```ts
type RestRoute<I, O> = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: (req: I) => string;                       // "v1/homes/" + req.id, query included
  body?: (req: I) => unknown;                     // omitted for GET / DELETE
  response: (json: unknown, status: number) => O; // JSON → proto message
};
const homesRoutes: { [K in keyof typeof HomesService.method]: RestRoute<...> };
```

- Shared converters for recurring shapes: `{ id }` → `IdResponse`, pagination → `?page&size`,
  `Struct` ↔ JSON object, `Timestamp` ↔ ISO string, empty response messages for 2xx without body.
- Forwards headers from interceptors (`Authorization`, `traceparent`); sets
  `Content-Type: application/json`; base URL is `configuration.getBaseUrl()` + `/api/`.
- Non-2xx → `ConnectError` with `Code` mapped from HTTP status:
  401 → Unauthenticated, 403 → PermissionDenied, 404 → NotFound, 408 → DeadlineExceeded,
  409 → AlreadyExists, 400/422 → InvalidArgument, 5xx → Unavailable (503) / Internal (others).
  Raw status and parsed problem body travel as a `RestProblem { httpStatus, body }` on
  `ConnectError.cause`; the `errors` interceptor turns them into `ApiError`.
- `stream()` throws `Unimplemented`. Live updates in REST mode bypass the transport (Section 4).
- Fixes the existing `v1/user/settings` path typo (UserProvider.tsx:96) as a side effect.

### 2b GrpcWebTransport (`transport/grpcWeb/`)

- `createGrpcWebTransport({ baseUrl, useBinaryFormat: true, fetch })`.
- React Native's built-in fetch does not expose a streaming `ReadableStream` body, so server
  streams fail. `polyfills.ts` exports `streamingFetch` (`fetch` from `expo/fetch`, which is
  binary-safe and streams response bodies) and installs `web-streams-polyfill` (`ReadableStream`)
  and `text-encoding` (`TextEncoder` / `TextDecoder`) only where the globals are missing.
  Imported once in `_layout.tsx`. `streamingFetch` is used for unary calls too, for one code path.

### 2c NativeGrpcTransport (`transport/nativeGrpc/`)

Local Expo module `senswave-grpc` (Kotlin, `io.grpc:grpc-okhttp`). The module moves bytes only;
serialisation stays in JS, so no Java codegen is required.

```ts
createChannel(target: string, opts: { tls: boolean; insecureSkipVerify?: boolean }): Promise<number>
closeChannel(channelId: number): void
unary(channelId, method: string, request: Uint8Array, headers: Record<string, string>, timeoutMs: number)
  : Promise<{ message: Uint8Array; headers: Record<string, string>; trailers: Record<string, string> }>
  // rejects with { code: number /* grpc status */, message: string; trailers }
serverStream(channelId, method, request, headers): number  // streamId
cancelStream(streamId): void
// events: onStreamHeaders, onStreamMessage, onStreamEnd (trailers, status), onStreamError
```

- `method` is the full path, e.g. `/senswave.homes.v1.HomesService/GetHome`. Marshaller is
  identity on `ByteArray`. Binary trailers (`*-bin`) cross the bridge base64-encoded.
- JS side: `toBinary(method.input, message)` → module → `fromBinary(method.output, bytes)`.
  Streams are adapted to `AsyncIterable`; `AbortSignal` maps to `cancelStream`.
- Channel lifetime equals `ApiProvider` lifetime: one `ManagedChannel` (one HTTP/2 connection)
  is created per base URL and reused for every unary call and stream. Keepalive is enabled
  (`keepAliveTime` 30 s, `keepAliveWithoutCalls` true). `closeChannel` runs only when the base
  URL or mode changes. gRPC-Web and REST rely on the platform fetch connection pool instead;
  no HTTP/2 guarantee exists there.
- Target is `host:port` derived from the base URL; `tls` from the scheme.
  `insecureSkipVerify` is allowed only when `EXPO_PUBLIC_ENVIRONMENT=Development`
  (backend dev certificate is self-signed).

## Section 3 — Interceptors, auth, errors, OpenTelemetry

Order (outer → inner): `otel` → `auth` → `legal` → `errors`. Built in `ApiProvider` and passed to
every transport through its `interceptors` option (connect-web has it natively; the REST and native
transports run `runUnaryCall` / `runStreamingCall` from `@connectrpc/connect/protocol`, which
applies interceptors and the deadline). Timeout is therefore a transport option
(`defaultTimeoutMs`), not an interceptor.

### auth

- Skips `AuthService` and `LegalService` (anonymous on the backend).
- If `session.authenticated` is false: `logout()` and throw `ConnectError(Unauthenticated)`.
- Adds `Authorization: Bearer <accessToken>` (read through a ref, so callbacks stay stable).
- On `Unauthenticated`: call `session.refresh()`. One in-flight refresh is shared by all
  concurrent callers (promise dedupe — the current code refreshes once per failing request).
  If refresh returns null: increment the failure counter, show the "check your internet
  connection" toast at 10 failures (existing behaviour), rethrow. Otherwise retry once.
- Streams: server-streaming requests get one refresh+retry while `next()` rejects with
  `Unauthenticated` (before any message); never mid-stream; client/bidi streams never retried.
  Later stream errors reach `LiveUpdateProvider`, which reconnects.

### legal

`PermissionDenied` → `logout()` + `onForbidden(error)` (toast of `errors[0].description`,
fallback "Access denied."). Same rule as the current 403 handling
(LegalMiddleware / LegalConsentInterceptor: missing consents).

Exempt: `req.stream` and `LiveUpdatesService` — a revoked home share or consent failure on the
stream ends the stream (terminal, no retry) but does not log out; the next unary call does.

### timeout

`defaultTimeoutMs: 15000` on every transport for unary calls; a call may override it with the
`timeoutMs` call option. Streams have no deadline. `ConfigurationProvider.isAppCompatibleWithApi()`
keeps its raw 5 s `executeTimeout` on `GET api/version`.

### errors

Normalises every failure into:

```ts
class ApiError extends Error {
  code: Code;              // Connect code
  message: string;         // gRPC status message / REST problem `detail` or `title`
  httpStatus?: number;     // REST only
  errors: Error[];         // common.v1.Error
  traceId?: string;
}
```

- gRPC modes: decode each `senswave-errors-bin` trailer entry with `fromBinary(ErrorSchema)`,
  read `senswave-trace-id`.
- REST: read `ErrorProblemDetails.errors` and `traceId` from the attached detail.
- Providers keep the `Result<T>` / `SimpleResult` pattern through a helper
  `call(() => api.homes.getHome(...)) : Promise<Result<T>>` that catches `ApiError`.

### SessionProvider and LegalProvider

- Ruling (final review PR 2): `SessionProvider` and `LegalProvider` sit above `ApiProvider`, so
  they use an anonymous client factory `createAnonymousApi(baseUrl, mode)` → `{ auth, legal }`
  built with `[createErrorInterceptor()]` only (both services are anonymous). Implemented in PR 3.
- All raw `executeTimeout` calls to `v1/auth/*` become `api.auth.*`. Login "email not confirmed"
  detection reads `ApiError.code === Code.Unauthenticated && ApiError.message === "NotAllowed"`
  in both modes: the gRPC `AuthService` throws `Unauthenticated` with the Identity `SignInResult`
  string as status message; the REST route maps the Identity 401 problem `detail` field to
  `ApiError.message`.
- Identity REST validation failures (register, reset password) return a 400
  `ValidationProblemDetails` whose `errors` is an object `{ [code]: string[] }`, while Senswave
  endpoints return `ErrorProblemDetails` whose `errors` is an array. The REST error parser accepts
  both and produces `common.v1.Error[]` (type `ERROR_TYPE_VALIDATION` for the Identity shape).
- Google login stays on the existing REST call and is hidden when `transportMode !== "Rest"`.
- `LegalProvider` uses `api.legal.getTermsAndConditions()` / `getPrivacyPolicy()`.

### OpenTelemetry

- Dependencies: `@opentelemetry/api`, `@opentelemetry/sdk-trace-base`,
  `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`,
  `@opentelemetry/semantic-conventions`.
- Enabled only when `EXPO_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise the no-op
  API provider is used and the interceptor adds nothing.
- `otel` interceptor creates a CLIENT span per call named
  `senswave.homes.v1.HomesService/GetHome` with attributes: `rpc.system`
  (`grpc` | `grpc-web` | `http`), `rpc.service`, `rpc.method`, `senswave.transport`,
  `rpc.grpc.status_code` or `http.response.status_code`, `senswave.request.bytes`,
  `senswave.response.bytes` (serialized length), `error.type`. Streams get one span for the
  subscription and an event per received message.
- Injects `traceparent` via the W3C propagator so backend spans join the client trace.
- Resource: `service.name=senswave-app`, `service.version=<app version>`,
  `senswave.transport=<mode>`, `device.model`.
- `BatchSpanProcessor`; force flush when `AppState` goes to background.
- The Docker compose in the backend maps `TELEMETRY_OTLP_HTTP_PORT` to the Aspire UI port
  (18888) rather than the OTLP/HTTP port (18890). Fixing that is a backend change, out of scope.

## Section 4 — Live updates

```ts
interface LiveUpdateSource {
  subscribe(
    homeId: string,
    onUpdate: (update: LiveUpdate) => void,
    onError: (error: ApiError) => void,
  ): () => void;  // unsubscribe
}
```

`LiveUpdate` is the generated proto message, used in both modes.

- gRPC / gRPC-Web: `for await (const u of api.liveUpdates.subscribe({ homeReferenceId }, { signal }))`.
  The stream has no deadline (`timeoutMs: 0`; otherwise it would inherit the 15 s unary default).
  Reconnect on error after 15 s (existing rule). The `Initialized` message means connected.
- REST: `SignalRLiveUpdateSource` wraps the current `SignalRProvider` logic. `"Update"(updateType, data)`
  is converted: `deviceTileActionUpdate` → `deviceTile`, `widgetsActionUpdate` → `widgets`,
  `dataSourceStateUpdate` → `dataSourceState`. `invoke("Initialize", homeId)` runs on subscribe.
  `AccessNotGrantedToHome` → `onError(PermissionDenied)`; the gRPC stream fails with the same code.
- `SignalRProvider` is deleted. `LiveUpdateProvider` takes `LiveUpdateSource` from `useApi()` and
  keeps its public API (`addDeviceTileCallback`, `addHomeDataSourceCallback`) unchanged.
  `@microsoft/signalr` remains a dependency.

## Section 5 — Call-site migration, testing, PR stack

### Migration

Every `useHttpClient()` call (53 files, 68 distinct endpoints) becomes `useApi()` plus a typed
client call. Manual `await res.response?.json()` parsing disappears. Generated proto types replace
local DTO types where shapes match; otherwise a small adapter lives in `src/types/*`.
Migration proceeds module by module (see PR stack).

### Testing

The repo has no tests today. Add `jest-expo`.

- Unit: REST mapping table (every RPC has a row; path, body and response round-trip against
  fixture JSON captured from the backend), error normaliser, interceptors (retry once, shared
  refresh, PermissionDenied logout), OTel attributes, SignalR → `LiveUpdate` conversion,
  `NativeGrpcTransport` with a mocked module.
- Contract: one opt-in Jest suite that runs against a live backend per mode when
  `SENSWAVE_E2E_URL` is set. Not part of CI.
- Manual smoke checklist per mode on an Android emulator.
- Every PR passes `npm run lint`, `npx tsc --noEmit` and `npx jest`.

### PR stack (each branch based on the previous one)

1. `chore: proto sync, codegen and api scaffolding` — Section 1 without consumers.
2. `feat: rest transport, interceptors and error model` — 2a, 3. `ApiProvider` mounted next to
   `HttpClientProvider`, unused by callers.
3. `feat: migrate auth, legal and users to api clients` — `SessionProvider`, `LegalProvider`, `UserProvider`.
4. `feat: migrate homes, rooms and sharing to api clients`.
5. `feat: migrate devices, dashboards, operations and widgets to api clients`.
6. `feat: migrate automations and datasources, remove HttpClientProvider`.
7. `feat: live update source abstraction` — Section 4 with the SignalR adapter.
8. `feat: grpc-web transport, polyfills and mode selection UI` — 2b.
9. `feat: native grpc expo module and transport` — 2c.
10. `feat: opentelemetry client spans and propagation`.

## Out of scope

- iOS support for native gRPC.
- Google login over gRPC (needs a backend `AuthService.LoginGoogle` RPC first).
- Fixing the backend Docker OTLP/HTTP port mapping.
- Rate limiting for gRPC (backend gap).
- Changes to the frozen REST DTO contract.

## Open questions resolved

- Native gRPC feasibility on React Native: no JS HTTP/2 client exists for Hermes; hence the
  Kotlin Expo module.
- Server streaming over gRPC-Web in React Native: requires the streaming fetch polyfill described in 2b.
- Live updates in gRPC modes: SignalR is not mapped; the proto stream replaces it.
