# Transport — gRPC-Web Transport, Polyfills and Mode Selector Implementation Plan (PR 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `TransportMode = "GrpcWeb"` work end to end: `createGrpcWebTransport` from `@connectrpc/connect-web` with the shared interceptors, streaming-capable `fetch` polyfills for React Native (needed by the live-update stream), a dev-only transport selector on `server.tsx`, and logout when base URL or mode changes.

**Architecture:** `createTransport` gains the `GrpcWeb` case (`createGrpcWebTransport({ baseUrl, useBinaryFormat: true, fetch, interceptors, defaultTimeoutMs })`). `src/api/polyfills.ts` installs `react-native-fetch-api` + `web-streams-polyfill` + `text-encoding` once (imported first in `_layout.tsx`) and exports the polyfilled `fetch` used by both REST and gRPC-Web transports. `ConfigurationProvider` exposes `overrideTransportMode` already; `server.tsx` gets a `HorizontalSelector` over `TransportModes` and a warning when `requestedTransportMode !== transportMode`. `ApiProvider` logs the session out when `baseUrl`/`requestedTransportMode` change after first mount.

**Tech Stack:** Expo 54, TS strict, `@connectrpc/connect-web` 2.2, `react-native-fetch-api`, `web-streams-polyfill`, `text-encoding`, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md` §1 (mode selection, logout on change), §2b

## Global Constraints

- `npm run typecheck`, `npm run lint`, `npm test` green after every task. Prettier 4-space, double quotes, trailing commas, width 100. Components `FC`.
- `fetch` only in `src/utils/httpClient.tsx`, `src/api/transport/rest/`, `src/api/transport/grpcWeb/` and `src/api/polyfills.ts`.
- Interceptors, `ApiError`, `call()`, routes unchanged — gRPC-Web must reuse them untouched. Trailer decoding (`senswave-errors-bin`) already exists in `toApiError`.
- Mode selector visible only when `configuration.isDevelopment()`; persisted via existing `overrideTransportMode`. Unimplemented mode (`Grpc` until PR 9) stays selectable but the screen shows "Falls back to Rest" when `requestedTransportMode !== transportMode`.
- Logout on URL/mode change: skip on first mount; `session.logout()` only if authenticated.
- Spec §2c native gRPC is out of scope (PR 9).
- Commits `feat:` / `chore:` ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env` or `.superpowers/`.
- Branch `feat/transport-8-grpc-web` based on `feat/transport-7-live-updates` (after its fix wave). Working dir `E:\ssm`.

## File map

| File | Responsibility |
|---|---|
| `src/api/polyfills.ts` | installs polyfills once; `export const streamingFetch: typeof fetch` |
| `src/api/transport/grpcWeb/createGrpcWebTransport.ts` | thin wrapper over connect-web |
| `src/api/transport/createTransport.ts` | `GrpcWeb` case; `fetch` default = `streamingFetch` |
| `tests/api/transport/grpcWeb/createGrpcWebTransport.test.ts` | unary + trailer error path with fake fetch producing gRPC-Web frames; stream smoke |
| `src/app/_layout.tsx` | `import "@/api/polyfills"` first |
| `src/app/server.tsx` | mode selector + fallback warning |
| `src/contexts/ApiProvider.tsx` | logout on change |
| `tests/contexts/apiProviderLogout.test.ts` | pure helper `shouldLogoutOnChange(prev, next)` test |
| `AGENTS.md`, `docs/.../spec` | GrpcWeb documented as implemented |

---

### Task 0: Stream-ready interceptors and live-update retry policy (from PR 7 final review)

Until now streams were never reachable (REST `stream()` throws). gRPC-Web makes `LiveUpdatesService.Subscribe` live, so:

- `src/api/interceptors/legalInterceptor.ts`: do NOT log out on `PermissionDenied` when `req.stream === true` or `req.service.typeName === LiveUpdatesService.typeName` — a revoked home share must not end the session. Still rethrow. Test both branches.
- `src/api/interceptors/authInterceptor.ts`: allow the refresh-and-retry-once path for streams too, but only before the response started (i.e. when `next(req)` rejects with `Unauthenticated` — Connect throws trailers-only errors from `stream()` before any message). Keep "no retry mid-stream" semantics (errors from iterating `res.message` never pass through the interceptor anyway). Test: stream `Unauthenticated` → refresh once → retried with new token.
- `src/contexts/domain/LiveUpdateProvider.tsx`: treat `PermissionDenied`, `Unimplemented`, `InvalidArgument` as terminal (log, no retry); after a stream that had reached `initialized` ends with `Unavailable`, resubscribe after 1 s + jitter (≤ 1 s) instead of 15 s; keep 15 s for failures before `initialized`. Extract `nextRetryDelayMs(err, hadInitialized): number | null` to `src/api/liveUpdates/retryPolicy.ts` with tests. Add `isTerminalLiveUpdateError(err)` next to it (UI stays `Code`-free).
- Commit `feat: stream-aware interceptors and live update retry policy`.

### Task 1: Polyfills and gRPC-Web transport

- [ ] `npm install react-native-fetch-api web-streams-polyfill text-encoding` (+ `@types/text-encoding` dev if needed). `src/api/polyfills.ts`:
  ```ts
  import { polyfillGlobal } from "react-native/Libraries/Utilities/PolyfillFunctions";
  import { ReadableStream } from "web-streams-polyfill";
  import { fetch as rnFetch, Headers, Request, Response } from "react-native-fetch-api";
  import { TextDecoder, TextEncoder } from "text-encoding";
  // install once, only where missing
  if (typeof globalThis.ReadableStream === "undefined") polyfillGlobal("ReadableStream", () => ReadableStream);
  if (typeof globalThis.TextEncoder === "undefined") polyfillGlobal("TextEncoder", () => TextEncoder);
  if (typeof globalThis.TextDecoder === "undefined") polyfillGlobal("TextDecoder", () => TextDecoder);
  export const streamingFetch: typeof fetch = (input, init) => rnFetch(input as never, { ...init, reactNative: { textStreaming: true } } as never);
  ```
  Verify import paths against the installed packages (`node_modules/react-native-fetch-api/README.md`); if `polyfillGlobal` is not exported in RN 0.81, assign `globalThis.X = X` directly. Jest: keep `polyfills.ts` out of tests (node has fetch/streams); mock `react-native-fetch-api` in `jest.config.js` `moduleNameMapper` to a stub returning `globalThis.fetch` if any test imports it transitively.
- [ ] `createGrpcWebTransport.ts`: `export const createSenswaveGrpcWebTransport = ({ baseUrl, fetch, interceptors, defaultTimeoutMs }) => createGrpcWebTransport({ baseUrl, useBinaryFormat: true, fetch: fetch ?? streamingFetch, interceptors, defaultTimeoutMs: defaultTimeoutMs ?? 15000 })`. Add the `GrpcWeb` case in `createTransport.ts`; REST transport default `fetch` becomes `streamingFetch` too (via `createTransport`, not inside `createRestTransport`, so unit tests keep injecting fakes).
- [ ] Tests: build `UsersService` client over the gRPC-Web transport with a fake `fetch` that returns a valid gRPC-Web binary response (use connect's own encoding helpers: `encodeEnvelope` from `@connectrpc/connect/protocol` with the `GetUserResponse` bytes, plus a trailer frame `grpc-status: 0`); assert the request `Content-Type: application/grpc-web+proto`, URL `${baseUrl}/senswave.users.v1.UsersService/GetUser`, and the decoded response. Error path: trailer frame `grpc-status: 5` + `senswave-errors-bin: <base64 Error>` → `call()` yields `ApiError` with `Code.NotFound` and `errors[0].code`. Interceptor path: auth interceptor header present.
- [ ] Commit `feat: grpc-web transport with streaming fetch polyfills`.

### Task 2: Mode selector and logout on change

- [ ] `server.tsx`: below the URL input add `HorizontalSelector` (`options: [...TransportModes]`, `selected: configuration.transportMode`, `onSelect: (o) => configuration.overrideTransportMode(parseTransportMode(o))`), only when `configuration.isDevelopment()`. Show a `Text` warning when `api.requestedTransportMode !== api.transportMode`: `"${requested} is not available on this build, using ${effective}."`. Reset button also clears the override (`overrideTransportMode(null)`).
- [ ] `src/api/transport/changeDetection.ts`: `shouldLogoutOnChange(prev: {baseUrl, mode} | null, next: {baseUrl, mode}): boolean` (false on first mount, true when either differs). Test.
- [ ] `ApiProvider`: `const prevRef = useRef<{baseUrl, mode} | null>(null)`; `useEffect(() => { if (shouldLogoutOnChange(prevRef.current, { baseUrl, mode: requestedTransportMode }) && sessionRef.current.session.authenticated) { console.info("[Api] Transport changed, logging out."); sessionRef.current.logout(); } prevRef.current = { baseUrl, mode: requestedTransportMode }; }, [baseUrl, requestedTransportMode])`.
- [ ] `_layout.tsx`: `import "@/api/polyfills";` as the first import.
- [ ] Docs: `AGENTS.md` env var row (`Rest | Grpc | GrpcWeb`; GrpcWeb implemented; Grpc pending PR 9), spec §1 "logout on change — implemented in PR 8".
- [ ] Verify; smoke if emulator and backend in GrpcWeb mode: login, home list, tile toggle via live stream; commit `feat: dev transport mode selector and logout on transport change`.

## Self-review
- Spec §2b (binary format, streaming polyfill, one code path), §1 selector + persistence + logout on change: covered. Trailer error decoding reused from PR 2. `Grpc` mode still falls back (PR 9).
