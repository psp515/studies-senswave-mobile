# Transport — Live Update Source Abstraction Implementation Plan (PR 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `SignalRProvider` with a transport-neutral `LiveUpdateSource` exposed from `ApiProvider`: SignalR behind it in REST mode, the `LiveUpdatesService.Subscribe` server stream in gRPC modes. `LiveUpdateProvider` consumes `LiveUpdate` proto messages in both cases and keeps its public API.

**Architecture:** `LiveUpdateSource.subscribe(homeId, onUpdate, onError) → unsubscribe`. Two implementations: `createSignalRLiveUpdateSource` (wraps `HubConnection`, maps `"Update"(type, data)` into `LiveUpdate` via a pure, tested `signalRUpdateToLiveUpdate`) and `createGrpcLiveUpdateSource` (iterates `client.subscribe` with an `AbortController`). `createLiveUpdateSource(mode, deps)` picks by effective transport mode. `LiveUpdateProvider` owns reconnection (15 s backoff, as today) and dispatches on the `LiveUpdate.update` oneof.

**Tech Stack:** Expo 54, TS strict, `@connectrpc/connect` 2.2, `@bufbuild/protobuf` 2.16, `@microsoft/signalr` 8, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md` §4

## Global Constraints

- `npm run typecheck`, `npm run lint`, `npm test` green after every task. Prettier 4-space, double quotes, trailing commas, width 100. Components `FC`.
- `useLiveUpdate()` public API unchanged: `addDeviceTileCallback(deviceId, cb)`, `addHomeDataSourceCallback(cb)`. Dispatch behaviour unchanged: `deviceTile` → registered device callback (called with `{ deviceId }`), `widgets` → `device.smartRefresh(deviceId)`, `dataSourceState` → `home.updateHomeDataSourceState(dataSourceId, state)`, `devicePresence` → `deviceList.refreshDevice(deviceId)`, `initialized` → log only. Unknown → log.
- Reconnect semantics unchanged: on source error wait 15 s then resubscribe while authenticated and a home is selected. `FailedToInitialize` about access (SignalR) / `PermissionDenied` (gRPC) → log error, no redirect (today's behaviour).
- SignalR URL stays `configuration.getSignalRUrl("signalr/liveupdates/live")` with `accessTokenFactory` reading the latest access token.
- No UI/provider code imports `@microsoft/signalr` or `Code` after this PR; `SignalRProvider.tsx` deleted; `@microsoft/signalr` stays a dependency.
- Commits `feat:` / `chore:` ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env` or `.superpowers/`.
- Branch `feat/transport-7-live-updates` based on `feat/transport-6-automations-datasources` (after its fix wave). Working dir `E:\ssm`.

## Wire facts

- SignalR hub `signalr/liveupdates/live`: client invokes `Initialize(homeId)`; server sends `"Update"(updateType: string, data)` with `updateType ∈ { "deviceTileActionUpdate" {deviceId}, "widgetsActionUpdate" {deviceId}, "dataSourceStateUpdate" {dataSourceId, state}, "devicePresenceUpdate" {deviceId} }`, `"Initialized"()` once the subscription is established, and `"FailedToInitialize"(reason: string)` (access problems mention "access" → PermissionDenied, otherwise Unavailable/retry). `AccessNotGrantedToHome` is kept only as a compatibility alias. Backend contract: `ILiveUpdatesHub { Initialized(); FailedToInitialize(reason); Update(updateType, data) }`.
- gRPC `LiveUpdatesService.Subscribe(SubscribeRequest{ homeReferenceId }) → stream LiveUpdate` with oneof `update`: `initialized {}`, `deviceTile { deviceId }`, `widgets { deviceId, widgetIds[] }`, `devicePresence { deviceId }`, `dataSourceState { dataSourceId, state }`. Generated at `@/api/gen/liveupdates/v1/liveupdates_pb` (`LiveUpdate`, `LiveUpdateSchema`, `LiveUpdatesService`); in TS the oneof is `update: { case: "deviceTile", value: DeviceTileUpdate } | …`.
- The REST transport's `stream()` throws `Unimplemented`; gRPC source is only selected for `Grpc`/`GrpcWeb` effective modes (which exist from PR 8 on). In REST mode the SignalR source is used.

---

## File map

| File | Responsibility |
|---|---|
| `src/api/liveUpdates/LiveUpdateSource.ts` | interface + `Unsubscribe` type |
| `src/api/liveUpdates/signalRMapping.ts` | `signalRUpdateToLiveUpdate(updateType, data): LiveUpdate \| null` (pure) |
| `src/api/liveUpdates/signalRLiveUpdateSource.ts` | `createSignalRLiveUpdateSource({ url, getAccessToken, buildConnection? })` |
| `src/api/liveUpdates/grpcLiveUpdateSource.ts` | `createGrpcLiveUpdateSource(client)` |
| `src/api/liveUpdates/createLiveUpdateSource.ts` | `createLiveUpdateSource({ mode, signalRUrl, getAccessToken, client })` |
| `tests/api/liveUpdates/*.test.ts` | mapping, grpc source (fake async-iterable client, abort), signalR source (fake connection) |
| `src/contexts/ApiProvider.tsx` | adds `liveUpdateSource` to the context value |
| `src/contexts/domain/LiveUpdateProvider.tsx` | consumes the source; owns reconnect |
| delete `src/contexts/SignalRProvider.tsx`; `src/app/_layout.tsx`; `AGENTS.md` | cleanup/docs |

---

### Task 1: Interface, SignalR mapping, gRPC source

**Interfaces produced:**
```ts
export type Unsubscribe = () => void;
export interface LiveUpdateSource {
    subscribe(homeId: string, onUpdate: (update: LiveUpdate) => void, onError: (error: ApiError) => void): Unsubscribe;
}
export const signalRUpdateToLiveUpdate = (updateType: string, data: unknown): LiveUpdate | null;
// "deviceTileActionUpdate" → { case: "deviceTile", value: { deviceId } }, "widgetsActionUpdate" → widgets { deviceId, widgetIds: [] },
// "dataSourceStateUpdate" → dataSourceState { dataSourceId, state }, "devicePresenceUpdate" → devicePresence { deviceId }, else null
export const createGrpcLiveUpdateSource = (client: Client<typeof LiveUpdatesService>): LiveUpdateSource;
// subscribe: const ac = new AbortController(); (async () => { try { for await (const u of client.subscribe({ homeReferenceId: homeId }, { signal: ac.signal })) onUpdate(u); if (!ac.signal.aborted) onError(new ApiError({ code: Code.Unavailable, message: "Live update stream ended" })); } catch (e) { if (!ac.signal.aborted) onError(toApiError(e)); } })(); return () => ac.abort();
```
- [ ] Tests first: mapping (4 types + unknown + missing fields → empty strings); grpc source with a fake client whose `subscribe` returns an async generator yielding two `LiveUpdate`s then ending → `onUpdate` ×2 then `onError(Unavailable)`; generator throwing `ConnectError(PermissionDenied)` → `onError` with `Code.PermissionDenied`; abort before second yield → no further callbacks.
- [ ] Implement; commit `feat: live update source interface, signalr mapping and grpc stream source`.

### Task 2: SignalR source

```ts
export interface SignalRLiveUpdateSourceOptions {
    url: string;
    getAccessToken: () => string;
    /** test seam; default builds HubConnectionBuilder().withUrl(url, { accessTokenFactory }).build() */
    buildConnection?: (url: string, accessTokenFactory: () => string) => HubConnection;
}
export const createSignalRLiveUpdateSource = (o: SignalRLiveUpdateSourceOptions): LiveUpdateSource;
```
`subscribe`: build connection; `on("Update", (t, d) => { const u = signalRUpdateToLiveUpdate(t, d); if (u) onUpdate(u); else console.info(...) })`; `on("AccessNotGrantedToHome", (homeId) => onError(new ApiError({ code: Code.PermissionDenied, message: \`Access not granted to home ${homeId}\` })))`; `onclose(() => { if (!stopped) onError(new ApiError({ code: Code.Unavailable, message: "Live update connection closed" })) })`; `start().then(() => invoke("Initialize", homeId)).then(() => onUpdate(create(LiveUpdateSchema, { update: { case: "initialized", value: {} } }))).catch((e) => { if (!stopped) onError(toApiError(e)) })`. Unsubscribe: `stopped = true; connection.stop().catch(() => undefined)`.
- [ ] Tests with a fake `HubConnection` (object with `on`, `onclose`, `onreconnecting`, `onreconnected`, `start`, `stop`, `invoke` as jest.fn; capture handlers): start → Initialize invoked with homeId → initialized update emitted; "Update" event mapped; AccessNotGranted → PermissionDenied; onclose after unsubscribe → no onError; start rejection → onError.
- [ ] Implement; commit `feat: signalr live update source`.

### Task 3: Factory, ApiProvider, LiveUpdateProvider, cleanup

- `createLiveUpdateSource({ mode, signalRUrl, getAccessToken, client })`: `mode === "Rest"` → SignalR source; else gRPC source. Test both branches (type-level: returned object has `subscribe`).
- `ApiProvider`: add `liveUpdateSource` to `ApiContextValue`; built inside the existing `useMemo` from the **effective** `transportMode`, `configuration.getSignalRUrl("signalr/liveupdates/live").toString()` (guard with try/catch like `resolveBaseUrl` — on failure use a source whose `subscribe` immediately calls `onError(Unavailable)` and returns a no-op), `getAccessToken: () => sessionRef.current.session.accessToken ?? ""`, `client: clients.liveUpdates`.
- `LiveUpdateProvider`: replace `useSignalR()` with `useApi().liveUpdateSource` + `useSession()`; one `useEffect([home.current?.id, session.session.authenticated, retry])`: if authenticated and home id → `const unsub = source.subscribe(homeId, dispatch, (err) => { console.error(...); if (err.code !== Code.PermissionDenied) timer = setTimeout(() => setRetry(r => r + 1), 15000); })`; cleanup → `unsub()` + `clearTimeout`. `dispatch(u)` switches on `u.update.case` per Global Constraints. Keep callbacks refs and `addDeviceTileCallback`/`addHomeDataSourceCallback` unchanged. The provider may import `Code` only via a helper `isPermissionDenied(err)` added to `src/api/call.ts` (keep `Code` out of contexts).
- Delete `SignalRProvider.tsx`; remove it from `_layout.tsx`; `AGENTS.md` Real-time section rewritten: `LiveUpdateSource`, SignalR in REST mode, gRPC stream otherwise; provider order.
- [ ] Verify (lint/typecheck/test; smoke if emulator: switch a device tile → tile refreshes via live update); commit `feat: LiveUpdateProvider consumes transport-neutral live update source`.

## Self-review
- Spec §4 covered: interface (T1), gRPC source (T1), SignalR adapter incl. Initialize + event mapping + AccessNotGranted (T2), provider rewrite + SignalRProvider deletion (T3), reconnect 15 s (T3).
- Names consistent: `LiveUpdateSource`, `signalRUpdateToLiveUpdate`, `createGrpcLiveUpdateSource`, `createSignalRLiveUpdateSource`, `createLiveUpdateSource`, `liveUpdateSource` on the Api context.
