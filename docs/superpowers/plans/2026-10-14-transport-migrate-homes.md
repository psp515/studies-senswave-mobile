# Transport Migration — Homes, Rooms, Sharing Implementation Plan (PR 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every `v1/homes…` call (HomeProvider, home/room/share screens, sharing components, HomeList) onto `useApi().homes / .rooms / .homeSharing`, adding the REST route rows for those three services.

**Architecture:** Same pattern as PR 3: declarative REST routes per service (`src/api/transport/rest/routes/{homes,rooms,homeSharing}.ts`) with JSON converters; call sites use `call()` / `callSimple()` + `toast.apiError(result)`; 404 handling becomes `result.error?.code === Code.NotFound`. Local `Home` type gets `dataSource?` (nullable on the backend); the home list uses the generated `HomeDto` shape.

**Tech Stack:** Expo 54, TS strict, `@connectrpc/connect` 2.2, `@bufbuild/protobuf` 2.16 (`timestampFromDate`, `timestampDate` from `@bufbuild/protobuf/wkt`), jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md` (§2a mapping table, §5 migration)

## Global Constraints

- `npm run typecheck`, `npm run lint`, `npm test` green after every task. Prettier 4-space, double quotes, trailing commas, width 100. Components `FC`.
- `fetch` only in `src/utils/httpClient.tsx` and `src/api/transport/rest/`. Callers consume errors only via `call()` / `callSimple()` / `toApiError()`; never inspect raw caught errors; never read HTTP status codes in UI code.
- Public context API of `useHome()` keeps its method names and return types. Screen behaviour (navigation, toasts, refreshes) unchanged except where this plan says so.
- `home/details.tsx:87` (`GET v1/datasources/brokers/{id}`) stays on `useHttpClient()` until PR 6; a file may use both hooks during the migration.
- REST paths relative to `/api/`, no leading slash. Backend REST contract (Homes module) is the source of truth below; routes must reproduce it exactly.
- Commits `feat:` / `fix:` ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env` or `.superpowers/`.
- Branch `feat/transport-4-homes` based on `feat/transport-3-auth-users` (5fe3df2). Working dir `E:\ssm`.

## Backend REST contract (Homes module)

| RPC (service) | REST | Body | Response | Notes |
|---|---|---|---|---|
| homes.getHomes `{page,size}` | GET `v1/homes?page=&size=` | — | `{ items: [{ id, dataSourceId: string\|null, name, icon, isOwner, location: {longitude, latitude} }] }` | omit query params when 0 (backend defaults 1/10) |
| homes.getHome `{homeId}` | GET `v1/homes/{homeId}` | — | `{ id, name, icon, isOwner, dataSource: {id: string\|null, state, name} \| null, location, rooms: [{id,name}] }` | `dataSource` null → unset |
| homes.getCurrentHome `{latitude?,longitude?}` | GET `v1/homes/current?latitude=&longitude=` | — | `{ id }` → `IdResponse` | 404 when user has no home |
| homes.createHome `{name, icon, latitude?, longitude?, dataSourceId?}` | POST `v1/homes` | `{ name, icon, latitude?, longitude? }` | 201 `{ id }` → `IdResponse` | `dataSourceId` ignored by backend; omit |
| homes.updateHome `{homeId, name, icon, latitude?, longitude?}` | PATCH `v1/homes/{homeId}` | `{ name?, icon?, latitude?, longitude? }` — send `name`/`icon` only when non-empty, lat/lng only when defined | 204 | preserves today's partial-PATCH behaviour |
| homes.deleteHome `{homeId}` | DELETE `v1/homes/{homeId}` | — | 204 | |
| homes.setHomeDataSource `{homeId, brokerId}` | PUT `v1/homes/{homeId}/datasource` | `{ brokerId }` | 204 | |
| homes.deleteHomeDataSource `{homeId}` | DELETE `v1/homes/{homeId}/datasource` | — | 204 | |
| rooms.displayRooms `{homeId}` | GET `v1/homes/{homeId}/rooms/display` | — | `{ items: [{id,name}] }` | 404 possible → caller treats as empty |
| rooms.getRoom `{homeId, roomId}` | GET `v1/homes/{homeId}/rooms/{roomId}` | — | `{ id, name }` | |
| rooms.createRoom `{homeId, name}` | POST `v1/homes/{homeId}/rooms` | `{ name }` | 201 `{ id }` → `IdResponse` | |
| rooms.updateRoom `{homeId, roomId, name}` | PATCH `v1/homes/{homeId}/rooms/{roomId}` | `{ name }` | 204 | |
| rooms.deleteRoom `{homeId, roomId}` | DELETE `v1/homes/{homeId}/rooms/{roomId}` | — | 204 | |
| homeSharing.getSharings `{homeId}` | GET `v1/homes/sharings?homeId=` | — | `{ items: [{ sharingId, friendEmail, sharingType }] }` | |
| homeSharing.createSharing `{homeId, friendEmail, sharingType}` | POST `v1/homes/sharings` | `{ homeId, friendEmail, sharingType }` | 201 `{ invitationId, password, expiresAtUtc: ISO, createdUtc: ISO }` | ISO → `Timestamp` via `timestampFromIso` |
| homeSharing.acceptSharing `{password}` | PUT `v1/homes/sharings` | `{ password }` | 204 | |
| homeSharing.deleteSharing `{homeSharingId}` | DELETE `v1/homes/sharings/{homeSharingId}` | — | 204 | |
| homeSharing.leaveSharing `{homeId}` | DELETE `v1/homes/sharings/leave/{homeId}` | — | 204 | |

Generated services: `HomesService` (`@/api/gen/homes/v1/homes_pb`), `RoomsService` (`rooms_pb`), `SharingService` (`sharing_pb`, exposed as `api.homeSharing`). Generated field names are camelCase (`homeId`, `isOwner`, `dataSourceId`, `expiresAtUtc`). `optional` proto fields are `T | undefined`; `page`/`size` are plain `number` (0 when unset).

---

## File map

| File | Responsibility |
|---|---|
| `src/api/transport/rest/routes/homes.ts`, `rooms.ts`, `homeSharing.ts` | route rows + JSON converters |
| `src/api/transport/rest/routes/index.ts` | register the three tables |
| `tests/api/transport/rest/routes/homes.test.ts`, `rooms.test.ts`, `homeSharing.test.ts` | coverage + shape tests |
| `src/types/HomeTypes.tsx` | `Home.dataSource?`, `HomeDataSource.id` nullable-safe, add `HomeListItemDto` alias |
| `src/contexts/domain/HomeProvider.tsx` | `useApi().homes / .rooms` |
| `src/app/(app)/home/add.tsx`, `details.tsx`, `room/add.tsx`, `room/details.tsx`, `share.tsx`, `dataSource/select.tsx` | screens |
| `src/components/homeSharing/JoinHomeForm.tsx`, `HomeSharingList.tsx`, `HomeSharingListItem.tsx`, `src/components/home/lists/HomeList.tsx` (+ `HomeListItem.tsx` if its prop type changes) | components |
| `AGENTS.md` | migration note |

---

### Task 1: REST routes for homes, rooms, homeSharing

**Files:**
- Create: `src/api/transport/rest/routes/homes.ts`, `rooms.ts`, `homeSharing.ts`
- Modify: `src/api/transport/rest/routes/index.ts`
- Create: `tests/api/transport/rest/routes/homes.test.ts`, `rooms.test.ts`, `homeSharing.test.ts`
- Modify (if needed): `src/api/transport/rest/converters.ts` — add `numOrUndefined(v): number | undefined`, `strOrUndefined(v): string | undefined`, `items(json, map): T[]` helper (`asRecord(json).items` array → map each; non-array → `[]`).

**Interfaces:**
- Consumes: `defineRoutes`, `RestRouteTable`, converters (`asRecord`, `str`, `bool`, `num`, `empty`, `query`, `timestampFromIso`).
- Produces: `homesRoutes`, `roomsRoutes`, `homeSharingRoutes: RestRouteRegistryEntry[]`, all appended to `restRoutes`.

- [ ] **Step 1: Failing tests** — one file per service. Each file has (a) a "covers every RPC" test comparing `routes.map(e => e.key).sort()` to `Service.methods.map(routeKey).sort()`; (b) per-RPC assertions of `method`, `path(req)`, `body?.(req)` and `response(json, status)` against the contract table above. Minimum specific cases:
  - homes: `getHomes` path with `{page:2,size:5}` → `v1/homes?page=2&size=5`, with `{page:0,size:0}` → `v1/homes`; `getHome` response maps `dataSource: null` → `dataSource: undefined` and `dataSource: {id: null, state:"Empty", name:""}` → `{ id: undefined, state:"Empty", name:"" }`, rooms array mapped, location mapped; `getCurrentHome` path with/without coords (`v1/homes/current?latitude=1.5&longitude=2.5`; `v1/homes/current`); `createHome` body omits undefined lat/lng and never sends `dataSourceId`; `updateHome` body with `name:""` and `icon:"x"` → `{ icon: "x" }`; `setHomeDataSource` body `{ brokerId }`; `deleteHomeDataSource` path.
  - rooms: all five paths, `createRoom` body `{name}`, `displayRooms` response items, `getRoom` response.
  - homeSharing: `getSharings` path `v1/homes/sharings?homeId=h1`; `createSharing` body and response with `expiresAtUtc`/`createdUtc` ISO → Timestamp seconds; `acceptSharing` PUT body `{password}`; `deleteSharing` path; `leaveSharing` path `v1/homes/sharings/leave/h1`.
  Use `create(XxxRequestSchema, {...})` for request messages.

- [ ] **Step 2: Run, expect fail** (`npm test -- tests/api/transport/rest/routes`).

- [ ] **Step 3: Implement** the three route files following `routes/users.ts` style; register in `index.ts`:
  ```ts
  export const restRoutes: RestRouteRegistryEntry[] = [
      ...usersRoutes, ...legalRoutes, ...authRoutes,
      ...homesRoutes, ...roomsRoutes, ...homeSharingRoutes,
  ];
  ```
  Converter sketch for `getHome`:
  ```ts
  response: (json) => {
      const j = asRecord(json);
      const ds = j.dataSource === null || j.dataSource === undefined ? undefined : asRecord(j.dataSource);
      return {
          id: str(j.id), name: str(j.name), icon: str(j.icon), isOwner: bool(j.isOwner),
          dataSource: ds ? { id: strOrUndefined(ds.id), state: str(ds.state), name: str(ds.name) } : undefined,
          location: location(j.location),
          rooms: items(j.rooms, (r) => ({ id: str(r.id), name: str(r.name) })),
      };
  },
  ```
  `location(v)` → `{ longitude: num(l.longitude), latitude: num(l.latitude) }`.

- [ ] **Step 4: Run, lint, typecheck, commit**
  ```bash
  npm test && npm run lint && npm run typecheck
  git add src/api/transport/rest/routes src/api/transport/rest/converters.ts tests/api/transport/rest/routes
  git commit -m "feat: rest routes for homes, rooms and home sharing services

  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

---

### Task 2: Types and HomeProvider

**Files:**
- Modify: `src/types/HomeTypes.tsx`
- Modify: `src/contexts/domain/HomeProvider.tsx`

**Interfaces:**
- `HomeTypes.tsx`: `HomeDataSource { id?: string; name: string; state: string }`; `Home { ...; dataSource?: HomeDataSource; ... }`; add `export type HomeListItemDto = HomeDto` (import `HomeDto` type from `@/api/gen/homes/v1/homes_pb`) for list consumers. Keep `Room`, `Location`, `HomeSharingDto`, `HomeRolesToName`.
- Add `export const toHome = (r: GetHomeResponse): Home` in `HomeTypes.tsx` (pure mapping; `location` defaults `{latitude:0, longitude:0}` when unset; `rooms` default `[]`).
- `useHome()` API unchanged: `loading`, `current`, `setCurrent(homeId): Promise<boolean>`, `refreshCurrent()`, `refreshRooms()`, `initializeCurrentHome(): Promise<boolean>`, `updateHomeDataSourceState(id, state)`.

- [ ] **Step 1: Types + `toHome`**, then fix any typecheck fallout from `dataSource?` (`home/details.tsx` already uses `current.dataSource?.id`; LiveUpdate/HomeProvider `updateHomeDataSourceState` must guard `dataSource`).

- [ ] **Step 2: HomeProvider** — replace `useHttpClient()` with `const api = useApi();`:
  - `setCurrent(homeId)`: `const r = await call(() => api.homes.getHome({ homeId }));` success → `setCurrentHome(toHome(r.data!))`, return true; failure → `console.error`, return false (no toast, as today).
  - `refreshRooms()`: `call(() => api.rooms.displayRooms({ homeId: currentHome.id }))`; success → rooms = `r.data!.items.map(({id,name}) => ({id,name}))`; `r.error?.code === Code.NotFound` → rooms `[]`; else `toast.apiError(r)`.
  - `initializeCurrentHome()`: `call(() => api.homes.getCurrentHome({ latitude, longitude }))` (pass `undefined` when location unavailable); `NotFound` → `toast.info("Create your first home!")`, current undefined, return false; other failure → `toast.apiError(r)`, return false; success → `const id = r.data!.id` then `call(() => api.homes.getHome({ homeId: id }))` → `setCurrentHome(toHome(...))`, return true; failure → `toast.apiError`, return false.
  - `refreshCurrent()`: `call(() => api.homes.getHome({ homeId: currentHome.id }))` → success `setCurrentHome(toHome(...))`; failure `console.error` only.
  - Remove `ListResponse`/`useHttpClient` imports.

- [ ] **Step 3: Lint, typecheck, test, commit**
  ```bash
  git add src/types/HomeTypes.tsx src/contexts/domain/HomeProvider.tsx
  git commit -m "feat: HomeProvider uses homes and rooms api clients

  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

---

### Task 3: Home and room screens

**Files:** `src/app/(app)/home/add.tsx`, `details.tsx`, `room/add.tsx`, `room/details.tsx`, `share.tsx`, `dataSource/select.tsx`

**Interfaces:** consumes `useApi()`, `call`/`callSimple`, `toast.apiError`. `HomeForm` / `RoomForm` value shapes unchanged.

- [ ] **Step 1: Per screen**
  - `add.tsx`: `callSimple(() => api.homes.createHome({ name, icon, latitude, longitude }))` (undefined lat/lng allowed); success path unchanged; failure `toast.apiError(result)`.
  - `details.tsx`: update → `callSimple(() => api.homes.updateHome({ homeId: id, name: values.name ?? "", icon: values.icon ?? "", latitude: values.latitude, longitude: values.longitude }))` (route sends only non-empty name/icon); delete → `api.homes.deleteHome({ homeId: id })`; leave → `api.homeSharing.leaveSharing({ homeId: id })`; delete datasource → `api.homes.deleteHomeDataSource({ homeId: id })`. Success paths unchanged; failures `toast.apiError(result)`. Leave `GET v1/datasources/brokers/{id}` on `httpClient` (PR 6).
  - `room/add.tsx`: `api.rooms.createRoom({ homeId: id, name })`; failure keeps `toast.error("Failed to add room.")` (today's wording) — use `toast.apiError(result, "Failed to add room.")`.
  - `room/details.tsx`: update `api.rooms.updateRoom({ homeId, roomId: id, name })`; delete `api.rooms.deleteRoom({ homeId, roomId: id })`; load `call(() => api.rooms.getRoom({ homeId, roomId: id }))` → `room.name`.
  - `share.tsx`: `call(() => api.homeSharing.createSharing({ homeId: current.id, friendEmail: email, sharingType: role }))` → use `data.password`; drop local `ShareHomeResponse` type; failure `toast.apiError(result)`; keep outer try/catch toast.
  - `dataSource/select.tsx`: `callSimple(() => api.homes.setHomeDataSource({ homeId: id, brokerId: brokerIdParam }))`; failure keeps the existing fixed message via `toast.apiError(result, "<existing text>")`.

- [ ] **Step 2: Lint, typecheck, test, commit**
  ```bash
  git commit -m "feat: home and room screens use homes api clients

  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

---

### Task 4: Sharing components and home list

**Files:** `src/components/homeSharing/JoinHomeForm.tsx`, `HomeSharingList.tsx`, `HomeSharingListItem.tsx`, `src/components/home/lists/HomeList.tsx`, `HomeListItem.tsx` (prop type only if needed), `AGENTS.md`

- [ ] **Step 1: Per component**
  - `JoinHomeForm`: `callSimple(() => api.homeSharing.acceptSharing({ password: code }))`; success unchanged; failure `toast.apiError(result)`.
  - `HomeSharingList`: `call(() => api.homeSharing.getSharings({ homeId: id }))` → `setHomeSharings(data.items.map(i => ({ sharingId: i.sharingId, friendEmail: i.friendEmail, sharingType: i.sharingType })))`; `NotFound` → `console.warn` + empty list; other failure `toast.apiError`.
  - `HomeSharingListItem`: `callSimple(() => api.homeSharing.deleteSharing({ homeSharingId: id }))`.
  - `HomeList`: `call(() => api.homes.getHomes({ page: 0, size: 0 }))` (backend defaults) → items typed `HomeListItemDto`, filtered by `homes.current?.id`; failure `toast.apiError(result, "Failed to load homes.")`. Adjust `HomeListItem` props to `HomeListItemDto` if it currently takes `Home` (it only needs id/name/icon/isOwner).
  - `AGENTS.md`: migration note "Migrated: homes, rooms, home sharing (PR 4)".

- [ ] **Step 2: Grep guard** — `grep -rn "v1/homes" src` must return nothing; `grep -rn "useHttpClient" src/contexts/domain/HomeProvider.tsx src/components/homeSharing src/components/home` must return nothing.

- [ ] **Step 3: Lint, typecheck, test; smoke on emulator if available (home list, create/edit/delete home, rooms, share + join, set/remove datasource); commit**
  ```bash
  git commit -m "feat: home sharing components and home list use api clients

  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
  ```

## Self-review
- Every `v1/homes…` endpoint (18) has a route row and a consumer migration (T1 ↔ T2–T4). `GET v1/datasources/brokers/{id}` in details.tsx intentionally stays (PR 6).
- Types: `toHome` (T2) consumed by HomeProvider (T2); `HomeListItemDto` (T2) consumed by HomeList (T4); route request field names match generated camelCase (`homeId`, `roomId`, `homeSharingId`, `brokerId`, `friendEmail`, `sharingType`).
- No placeholders; code sketches are complete enough given the established PR-3 pattern (implementers read `routes/users.ts`, `UserProvider.tsx` for the idiom).
