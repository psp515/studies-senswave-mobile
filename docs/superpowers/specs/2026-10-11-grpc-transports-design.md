# gRPC and gRPC-Web transports for the mobile app

**Status:** design approved 2026-10-11
**Platform:** Android only
**Backend counterpart:** `studies-senswave-backend` specs `2026-09-16-grpc-contracts-design.md` (Spec 0), `2026-09-16-grpc-services-design.md` (Spec A), `2026-09-16-grpc-web-design.md` (Spec B), and `docs/comparison.md` (Spec D)

## Purpose

The backend now serves its API over one of three transports, selected by `Transport__Mode` = `Rest` | `Grpc` | `GrpcWeb`. Exactly one API surface is live at a time: in the gRPC modes the REST endpoints, the Identity API and the SignalR hub are not mapped. The mobile app must therefore be able to speak each transport, selected by an environment variable, so that each backend mode has a matching client.

## Hard requirements

- **All three modes are supported long-term.** `Rest` is the default and stays a first-class mode. No mode is deprecated, and no REST or SignalR code is deleted.
- **Switching is env-only.** `EXPO_PUBLIC_TRANSPORT` = `Rest` | `Grpc` | `GrpcWeb`, read once at startup and baked into the build. Unset means `Rest`. There is no runtime switch.
- **Full parity.** Every feature the app offers today works in every mode, except Google login, which the backend serves in `Rest` mode only.
- **Single source of truth for contracts.** The backend `.proto` files drive all gRPC code in the app. No hand-written protobuf code.
- **Android only.** iOS is not built or tested for gRPC modes.

## Out of scope

- iOS support for the gRPC modes.
- Google login over gRPC (the backend has none).
- The gRPC-Web text format (`application/grpc-web-text`). Only the binary format is used.
- Runtime transport switching, or a dev-screen picker.
- Removing or rewriting REST or SignalR behavior.

## What stays HTTP in every mode

The backend keeps these routes in all modes, so the app keeps calling them over plain HTTP regardless of transport:

- `GET api/version` (the compatibility check in `ConfigurationProvider`).
- `GET api/v2/auth/confirmEmail` (the email deep-link target, opened from a browser).
- `/.well-known/*` (app-link verification, used by Android itself).

## Architecture

```
UI / feature providers (logic unchanged)
        |  useDevicesApi().getDevice(id) -> Result<DeviceDto>
        v
src/api/<feature>/
   <Feature>Api.ts        interface
   rest<Feature>Api.ts    REST implementation (today's HTTP calls, moved here)
   grpc<Feature>Api.ts    gRPC implementation (shared by Grpc and GrpcWeb)
   mappers.ts             proto <-> app DTO
        |
        +-- Rest:            HttpClientProvider (internals unchanged)
        +-- Grpc / GrpcWeb:  generated clients (src/generated/)
                 | RpcTransport
                 +-- NativeGrpcTransport    -> modules/senswave-grpc (Kotlin, grpc-java)
                 +-- GrpcWebFetchTransport  -> expo/fetch
```

### Feature APIs

One folder per feature under `src/api/`: `auth`, `users`, `legal`, `homes`, `rooms`, `homeSharing`, `devices`, `operations`, `widgets`, `dashboards`, `deviceSharing`, `automations`, `dataSources`.

- Each feature defines a TypeScript interface whose methods return the existing `Result<T>` / `SimpleResult` and use the existing app DTOs from `src/types/`. UI components keep working with those DTOs.
- The REST implementation contains the HTTP calls that are in the providers and components today, moved without behavior change.
- The gRPC implementation calls the generated `protobuf-ts` client and maps proto messages to and from app DTOs in `mappers.ts`. The same implementation serves both `Grpc` and `GrpcWeb`; only the `RpcTransport` underneath differs.
- After migration, `useHttpClient` is imported only from `rest*Api.ts` files. An ESLint `no-restricted-imports` rule enforces this.

### Transport selection

- `src/config/transport.ts` reads `EXPO_PUBLIC_TRANSPORT`, validates it against the three values, and defaults to `Rest`. An invalid value logs an error and falls back to `Rest`. The active mode is logged at startup.
- In `Grpc` and `GrpcWeb` modes the API base URL (`EXPO_PUBLIC_SENSWAVE__API__URL`) must be `https://`. The backend container is HTTPS-only, and native gRPC needs HTTP/2 over TLS. A non-HTTPS URL in a gRPC mode logs an error at startup.
- `ApiProvider` (new context) builds the feature API implementations once for the chosen mode and exposes hooks such as `useAuthApi()` and `useDevicesApi()`. Feature code never reads the mode, with one exception: the login screen hides the Google button when the mode is not `Rest`.

### `GrpcClientProvider`

- Holds the single `RpcTransport` for the mode and the generated service clients.
- An interceptor adds `authorization: Bearer <accessToken>` to every call except `senswave.users.v1.AuthService/*` and `senswave.users.v1.LegalService/*`.
- Applies the status mapping in "Error handling", including the refresh-and-retry on `UNAUTHENTICATED`.
- Default deadline 15 s per unary call, matching the REST timeout.

## Code generation

- Backend protos are vendored into `protos/` (same directory layout as `src/Shared/Senswave.Contracts/Protos/` in the backend).
- `npm run proto:sync` copies the protos from `../studies-senswave-backend/src/Shared/Senswave.Contracts/Protos/` and regenerates `src/generated/` with `@protobuf-ts/plugin`, using `@protobuf-ts/protoc` so no system `protoc` install is needed.
- Both `protos/` and `src/generated/` are committed. CI and EAS cloud builds need neither the backend checkout nor `protoc`. Contract changes show up as diffs in pull requests.
- Runtime dependencies: `@protobuf-ts/runtime`, `@protobuf-ts/runtime-rpc`, `@protobuf-ts/grpcweb-transport`.

## Native gRPC: `modules/senswave-grpc`

A local Expo module (Kotlin, Android only), autolinked during prebuild. `/android` stays gitignored.

**Dependencies:** `io.grpc:grpc-okhttp` and `io.grpc:grpc-stub`, latest stable versions pinned in the module's `build.gradle`.

**Channel:**

- One `ManagedChannel` per base URL, created lazily with `useTransportSecurity()`.
- Rebuilt when the base URL changes (`ConfigurationProvider.overrideUrl` in Development).
- Shut down when the module is destroyed.

**Methods:**

- A generic `MethodDescriptor<ByteArray, ByteArray>` with a pass-through marshaller, built at runtime from the full method name (for example `senswave.devices.v1.DevicesService/GetDevice`) and cached per name.
- No per-service Java or Kotlin code generation. JavaScript serializes and deserializes the messages; Kotlin only moves bytes and metadata.

**JavaScript API:**

| Member | Shape |
|---|---|
| `unary(method, requestBase64, metadata, deadlineMs)` | Promise of `{ status, message, responseBase64?, headers, trailers }`. Never rejects for gRPC errors: the status is data. |
| `startServerStream(callId, method, requestBase64, metadata)` | Starts a server-streaming call. |
| `cancel(callId)` | Cancels a running stream. |
| event `onStreamMessage` | `{ callId, base64 }` |
| event `onStreamClose` | `{ callId, status, message, trailers }` |

Metadata keys ending in `-bin` are passed base64-encoded in both directions.

**`NativeGrpcTransport.ts`** implements the `protobuf-ts` `RpcTransport` interface (`unary`, `serverStreaming`) on top of the module. It maps the abort signal to `cancel` and takes the deadline from `RpcOptions.timeout`. Client and bidirectional streaming are not implemented: the backend contracts forbid them.

**Measurement caveat:** payloads cross the React Native bridge as base64. Payloads are small (kilobytes), so the overhead is acceptable, but `docs/comparison.md` in the backend must note it when mobile timings are compared across transports.

## gRPC-Web

- `GrpcWebFetchTransport` from `@protobuf-ts/grpcweb-transport`, `format: "binary"`, `baseUrl` set to the API origin.
- The transport must run on `fetch` from `expo/fetch`, which supports streamed response bodies on Android. React Native's built-in `fetch` buffers the whole body, which breaks the `Subscribe` stream. If the transport does not accept an injected `fetch`, wrap it in a thin subclass or vendor a minimal transport. Decide this during implementation.
- **Acceptance criterion:** on an Android device, `Subscribe` delivers `Initialized` and then a later update incrementally, without waiting for the stream to end.

## Dev TLS trust

- Expo config plugin `plugins/withDevCaTrust.js` writes `res/xml/network_security_config.xml` and references it from the manifest.
- The config adds a `<domain-config>` for the dev hosts listed in `EXPO_PUBLIC_DEV_CA_HOSTS` (comma-separated, read at prebuild). Inside it, the bundled `certs/dev-ca.crt` and the system CAs are trust anchors.
- The plugin applies to every build type, as requested. Trust is scoped to the listed dev hosts, so production domains such as `api.senswave.net` keep system CAs only. Do not move the dev CA into `<base-config>`: the production app would then trust a CA whose private key lives on developer machines.
- OkHttp (native gRPC), React Native `fetch` and `expo/fetch` all use the platform trust manager, so the one config covers all three transports.
- The dev certificate's SAN must match the host the app calls. Verify during implementation whether `domain-config` matches IP literals such as `10.0.2.2`. If it does not, use a host name for the dev backend.

## Live updates

- New interface `LiveUpdatesSource`, emitting one normalized union:
  `initialized | deviceTile {deviceId} | widgets {deviceId, widgetIds} | devicePresence {deviceId} | dataSourceState {dataSourceId, state}`.
- `SignalRSource`: today's `SignalRProvider` logic, unchanged, mapping the `"Update"` event types onto the union. `AccessNotGrantedToHome` is still logged with no redirect.
- `GrpcStreamSource`: opens one `LiveUpdatesService.Subscribe(home_reference_id)` per active home. On home change it cancels the stream and opens a new one. On stream failure or end it reconnects with backoff. On `UNAUTHENTICATED` it refreshes the token before reconnecting. On `PERMISSION_DENIED` it logs, does not redirect, and does not log the user out.
- `LiveUpdateProvider` consumes only the union and no longer imports SignalR types. `devicePresence` is handled like a device tile refresh. The public hooks (`addDeviceTileCallback`, `addHomeDataSourceCallback`) are unchanged.

## Authentication, users, legal

- `AuthApi` covers `login`, `register`, `refresh`, `confirmEmail`, `resendConfirmationEmail`, `forgotPassword`, `resetPassword` and `loginGoogle`.
  - The REST implementation keeps the current `executeTimeout` code.
  - The gRPC implementation calls `senswave.users.v1.AuthService`. The calls are anonymous, so the auth interceptor does not run.
  - In gRPC modes `loginGoogle` returns a failure ("not supported in this transport").
- `SessionProvider` calls `AuthApi` instead of building requests itself. Token storage (`expo-secure-store`), `rememberMe` and the token shape (`AccessTokenResponse`: `token_type`, `access_token`, `expires_in`, `refresh_token`) are unchanged.
- `UsersApi` and `LegalApi` cover user data, settings, account deletion, consents, terms and privacy. The consent screen flow is unchanged.

## Error handling

### Status mapping

Lives in `src/api/grpc/status.ts`. The goal is that each gRPC outcome triggers the same app behavior as its REST equivalent today.

| gRPC status | Backend source | App behavior |
|---|---|---|
| `OK` | | success |
| `UNAUTHENTICATED`, any call outside `AuthService` | expired access token | refresh once and retry; if refresh fails, follow today's REST 401 path (failure counter, toast after 10) |
| `UNAUTHENTICATED` from `AuthService/Login`, detail `NotAllowed` | email not confirmed | show the resend-confirmation button, as for REST 401 `NotAllowed` |
| `UNAUTHENTICATED` from `AuthService/Login`, any other detail | bad credentials, lockout | invalid-credentials message |
| `PERMISSION_DENIED` on a service outside `senswave.users.v1` and `senswave.liveupdates.v1` | `LegalConsentInterceptor` (missing consents) | logout and toast, as for REST 403 |
| `PERMISSION_DENIED` from `LiveUpdatesService/Subscribe` | no access to the home | log only, as for `AccessNotGrantedToHome` |
| `INVALID_ARGUMENT`, `FAILED_PRECONDITION`, `NOT_FOUND`, `ALREADY_EXISTS`, `INTERNAL` | `ErrorHandlingInterceptor` | `Result.failure` carrying the decoded error descriptions; toast as for REST errors |
| `UNAVAILABLE` | network failure | as for REST 500 |
| `DEADLINE_EXCEEDED` | 15 s deadline | as for REST 408 |

Logout is driven only by the consent case, matched on status plus service package, so a home-access denial on the live-updates stream never logs the user out.

### Unified error shape

- New type `ApiError = { statusText, errors: { code, description }[], traceId? }`.
- For REST it is built from the ProblemDetails body; for gRPC it is built from `Status.Detail`, the `senswave-errors-bin` trailer (serialized `senswave.common.v1.Error[]`) and the `senswave-trace-id` trailer.
- `ToastProvider` gains `apiError(error: ApiError)`. `httpError` becomes a thin adapter onto it.

## Delivery

One pull request per step to `main`, titled per the AGENTS.md format (`feat:` / `fix:` / `chore:`). Every step must build and pass the manual checklist in `Rest` mode before merge, so REST never regresses mid-migration. From step 3 on, the checklist also runs in `Grpc` and `GrpcWeb` for the features migrated so far.

1. **Foundation.** `protos/`, `npm run proto:sync`, `src/generated/`, `src/config/transport.ts`, env entries, `ApiError` and the status mapping, the dev CA config plugin, Jest setup.
2. **Transports.** `modules/senswave-grpc`, `NativeGrpcTransport`, gRPC-Web transport on `expo/fetch`, `GrpcClientProvider`, `ApiProvider` skeleton. Smoke test: `LegalService.GetPrivacyPolicy` (anonymous) in both gRPC modes.
3. **Auth, users, legal, consents.** `AuthApi`, `UsersApi`, `LegalApi`, the `SessionProvider` refactor, hiding Google login in gRPC modes. Login, consents and profile work end-to-end in all three modes.
4. **Live updates.** `LiveUpdatesSource`, `SignalRSource`, `GrpcStreamSource`, `LiveUpdateProvider` refactor.
5. **Homes.** Homes, rooms, home sharing.
6. **Devices.** Devices, operations, widgets, dashboards, device sharing.
7. **Automations and data sources.**
8. **Finish.** ESLint `no-restricted-imports` rule for `useHttpClient` outside `rest*Api.ts`, AGENTS.md and `.env.template` updates. REST code moves into the REST implementations in earlier steps; nothing is removed here.

## Testing

### Automated

The repo has no test runner today. Add Jest with the `jest-expo` preset, for pure logic only:

- Mappers per feature, proto to DTO and DTO to proto.
- The REST JSON to DTO paths that move into `rest*Api.ts`.
- The status mapping table.
- `senswave-errors-bin` decoding into `ApiError`.
- `EXPO_PUBLIC_TRANSPORT` parsing and the fallback.
- `NativeGrpcTransport` against a mocked native module, covering unary success, error status, streaming and cancellation.

The Kotlin module has no unit tests; the manual checklist covers it.

CI (`build.yaml`) gains `npm test` and a check that regenerating from `protos/` produces no diff in `src/generated/`.

### Manual checklist (per mode)

Run on an Android emulator against a local HTTPS backend whose `Transport__Mode` matches the app:

- Login, including the unconfirmed-email case. Logout.
- Consent screen: accept consents; revoking consents on the server logs the user out.
- Token refresh after the access token expires.
- One create, read, update and delete flow per feature.
- A widget action, and the resulting live update arriving.
- A data source state change arriving live.
- Switching the active home re-subscribes live updates.
- `GrpcWeb` only: `Subscribe` delivers messages incrementally.

**Final acceptance:** the full checklist passes in all three modes.

## Documentation

- AGENTS.md: a transport-modes section covering the env variable, `npm run proto:sync`, dev CA setup, and how to add an rpc (sync protos, add the method to the feature interface, implement it in both REST and gRPC, add a mapper test).
- `.env.template`: `EXPO_PUBLIC_TRANSPORT=Rest` and `EXPO_PUBLIC_DEV_CA_HOSTS=`.
