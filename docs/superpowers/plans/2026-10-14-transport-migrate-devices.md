# Transport Migration — Devices, Dashboards, Operations, Widgets Implementation Plan (PR 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every `v1/devices…` call (device/dashboard/operation/widget providers, screens, tiles, widget controls, operation pickers in automation forms) onto `useApi().devices / .dashboards / .operations / .widgets`, adding REST route rows for those services plus devices `SharingService` (routes only; no app consumer).

**Architecture:** Same template as PR 4 (final-review guidance): declarative REST routes with `seg()` for path params, `idResponse`, `items()`, `query()`; call sites use `call()/callSimple(fn, "<old fixed text>")`, `toast.apiError(result)` bare, `isNotFound(result)` where the old code branched on 404. New: `google.protobuf.Value` fields (`tile.value`, action `value`) are proto messages in TS, so a small `src/api/json.ts` converts JSON ⇄ `Value`; UI keeps working with plain JSON through `toDevice()` mappers.

**Tech Stack:** Expo 54, TS strict, `@connectrpc/connect` 2.2, `@bufbuild/protobuf` 2.16 (`ValueSchema`, `toJson`, `fromJson`, `timestampDate` from `@bufbuild/protobuf` / `@bufbuild/protobuf/wkt`), jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md` (§2a, §5)

## Global Constraints

- `npm run typecheck`, `npm run lint`, `npm test` green after every task. Prettier 4-space, double quotes, trailing commas, width 100. Components `FC`.
- `fetch` only in `src/utils/httpClient.tsx` and `src/api/transport/rest/`. UI never reads HTTP status or raw errors; use `call()/callSimple()`, `toast.apiError(result)`, `isNotFound(result)`.
- Template (binding, from PR 4 final review): every path segment via `seg(value, "name")`; `{id}` via `idResponse`; 204 via `empty`; lists via `items()`; `query({...})` with `x || undefined` only where 0 means unset (page/size); fixed wording passed to `call()`, never to `toast.apiError`; no `id as string` casts to feed path params — guard instead; no local `enc` helpers; UI files do not import `Code` (use `isNotFound`).
- Public context APIs (`useDeviceList()`, `useDevice()`, `useWidgetDetails()`) keep method names/return types; screen behaviour (toasts, navigation, refresh, live-update hooks) unchanged except where stated.
- Fixed user-facing strings keep today's wording (quoted per call site below).
- Backend REST contract below is the source of truth; routes reproduce it exactly.
- Commits `feat:` / `fix:` ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env` or `.superpowers/`.
- Branch `feat/transport-5-devices` based on `feat/transport-4-homes` (after its fix wave). Working dir `E:\ssm`.

## Backend REST contract (Devices module)

Enums are strings on both transports (`OperationType`: Number|Boolean|Text|Integer|Options|HexColor; `WidgetType`: Button|Display|Slider|Switch|Radio|Color|TimeSeriesGraph|""; tile type Switch|Display|Default|""; presence type Default|BooleanOperation|""). `configuration` = JSON object (proto `Struct` → TS `JsonObject`). `value` = JSON scalar (proto `Value` message in TS). Every list endpoint returns **404** when empty — callers map `isNotFound` → empty list exactly where the old code did.

| RPC | REST | Body | Response | Notes |
|---|---|---|---|---|
| devices.createDevice `{homeId, roomId?, name, icon}` | POST `v1/devices` | `{ homeId, roomId: <omit when unset; null when "">, name, icon }` | 201 `{id}` → `IdResponse` | |
| devices.getDevice `{deviceId}` | GET `v1/devices/{deviceId}` | — | `{ id, name, icon, roomId: str\|null, tile: { type, operationId: str\|null, displayableOperationId: str\|null, configuration: obj\|null }, presence: { type, operationId: str\|null } }` | null → unset; configuration null → `{}` |
| devices.updateDevice `{deviceId, roomId?, name, icon, operationId?, displayableOperationId?, configuration?, type, presenceOperationId, presenceType}` | PATCH `v1/devices/{deviceId}` | `{ roomId: <omit unset; null when "">, name?: non-empty only, icon?: non-empty only, operationId: <omit unset; null when "">, displayableOperationId: <same>, configuration?: when defined, type?: non-empty only, presenceOperationId?: non-empty only, presenceType?: non-empty only }` | 204 | |
| devices.deleteDevice `{deviceId}` | DELETE `v1/devices/{deviceId}` | — | 204 | |
| devices.displayDevices `{homeId, page?, size?}` | GET `v1/devices/display?homeId=&page=&size=` | — | `{ items: DisplayDeviceDto[] }` | 404 when none |
| devices.displayDevice `{deviceId}` | GET `v1/devices/{deviceId}/display` | — | `DisplayDeviceDto` **unwrapped** → response `{ device: dto }` | |
| devices.deviceTileAction `{deviceId, value}` | POST `v1/devices/{deviceId}/tile/action` | `{ value: toJson(ValueSchema, req.value) }` | `DisplayDeviceDto` unwrapped → `{ device: dto }` | |
| dashboards.createDashboard `{deviceId, name, icon, configuration}` | POST `v1/devices/dashboards` | `{ deviceId, name, icon, configuration }` | 201 `{id}` | |
| dashboards.getDashboard `{dashboardId}` | GET `v1/devices/dashboards/{dashboardId}` | — | `{ id, name, icon, type, configuration }` | |
| dashboards.updateDashboard `{dashboardId, name, icon}` | PATCH `v1/devices/dashboards/{dashboardId}` | `{ name?: non-empty, icon?: non-empty }` | 204 | |
| dashboards.deleteDashboard `{dashboardId}` | DELETE `v1/devices/dashboards/{dashboardId}` | — | 204 | |
| dashboards.displayDashboards `{deviceId}` | GET `v1/devices/dashboards/display?deviceId=` | — | `{ items: [{id,name,icon,type}] }` | 404 when none |
| dashboards.displayDashboard `{dashboardId}` | GET `v1/devices/dashboards/{dashboardId}/display` | — | `{ type, configuration }` | configuration carries rows/columns/positionedWidgets/calculatedWidgets |
| dashboards.setWidgetOnDashboard `{dashboardId, widgetId, row, rowSpan, column, columnSpan}` | PUT `v1/devices/dashboards/{dashboardId}/widgets` | `{ widgetId, row, rowSpan, column, columnSpan }` | 204 | |
| dashboards.deleteDashboardWidget `{dashboardId, widgetId}` | DELETE `v1/devices/dashboards/{dashboardId}/widgets/{widgetId}` | — | 204 | |
| operations.createOperation `{deviceId, name, type, configuration, topic}` | POST `v1/devices/operations` | `{ deviceId, name, type, configuration, topic }` | 201 `{id}` | |
| operations.getOperation `{operationId}` | GET `v1/devices/operations/{operationId}` | — | `{ id, topic, name, type, configuration }` | |
| operations.deleteOperation `{operationId}` | DELETE `v1/devices/operations/{operationId}` | — | 204 | |
| operations.displayOperations `{deviceId, page, size}` | GET `v1/devices/operations/display?deviceId=&page=&size=` | — | `{ items: [{id,name,type}] }` | page/size omitted when 0; 404 when none |
| widgets.createWidget `{operationId, name, type, configuration}` | POST `v1/devices/widgets` | `{ operationId, name, type, configuration }` | 201 `{id}` | |
| widgets.getWidget `{widgetId}` | GET `v1/devices/widgets/{widgetId}` | — | `{ id, deviceId, operationId, name, type, enabled, configuration }` | |
| widgets.deleteWidget `{widgetId}` | DELETE `v1/devices/widgets/{widgetId}` | — | 204 | |
| widgets.displayWidgets `{deviceId}` | GET `v1/devices/widgets/display?deviceId=` | — | `{ items: [{ operation: {id,name,type}, widgets: [{id,name,type,enabled}] }] }` | 404 when none |
| widgets.action `{widgetId, value}` | POST `v1/devices/widgets/{widgetId}/action` | `{ value: toJson(ValueSchema, req.value) }` | 204 → empty | |
| widgets.state `{widgetId, enabled}` | PUT `v1/devices/widgets/{widgetId}/state` | `{ enabled }` | 204 | |
| deviceSharing.getSharings `{deviceId}` | GET `v1/devices/sharings?deviceId=` | — | `{ items: [{ sharingId: str\|null, friendEmail, sharingType }] }` | no app consumer |
| deviceSharing.setSharing `{deviceId, sharingType, friendEmail}` | PUT `v1/devices/sharings` | `{ deviceId, sharingType, friendEmail }` | 204 | |
| deviceSharing.deleteSharing `{deviceSharingId}` | DELETE `v1/devices/sharings/{deviceSharingId}` | — | 204 | |

`DisplayDeviceDto` JSON: `{ id, roomId: str|null, name, icon, tile: { type, value: <any JSON>|null, configuration: obj|null }, presence: { type, value: bool|null, lastSeenAtUtc: ISO|null }, createdAtUtc: ISO, updatedAtUtc: ISO }` → proto `DisplayDeviceDto { id, roomId?, name, icon, tile: { type, value: Value, configuration: Struct }, presence: { type, value?: bool, lastSeenAtUtc?: Timestamp }, createdAtUtc?: Timestamp, updatedAtUtc?: Timestamp }`. Generated files: `@/api/gen/devices/v1/{devices,dashboards,operations,widgets,sharing}_pb` (`SharingService` exposed as `api.deviceSharing`). Read them for exact field names and optionality before writing routes.

---

## File map

| File | Responsibility |
|---|---|
| `src/api/json.ts` | `toProtoValue(json: unknown): Value`, `fromProtoValue(v: Value \| undefined): unknown` (null when unset), `structToJson(s: JsonObject \| undefined): Record<string, unknown>` (`{}` when unset) |
| `tests/api/json.test.ts` | |
| `src/api/transport/rest/routes/devices.ts`, `deviceSharing.ts`, `dashboards.ts`, `operations.ts`, `widgets.ts` + tests | route rows |
| `src/api/transport/rest/routes/index.ts` | register |
| `src/types/DeviceTypes.tsx` | add `"TimeSeriesGraph"` + `""` to `WidgetType`; `Device`, `DeviceTile`, `DevicePresence` types move here from `DeviceListProvider` (exported, same shapes, `roomId?: string`, timestamps ISO strings); mappers `toDevice(dto: DisplayDeviceDto)`, `toDeviceDetails(r: GetDeviceResponse): Device`, `toOperationDto`, `toWidgetDto`, `toOperationGroups` |
| `tests/types/DeviceTypes.test.ts` | mapper tests |
| `src/contexts/custom/DeviceListProvider.tsx`, `DeviceProvider.tsx`, `WidgetDetailsProvider.tsx` | providers |
| `src/app/(app)/device/add.tsx`, `details.tsx`, `src/components/device/tile/DisplayDeviceTile.tsx`, `SwitchDeviceTile.tsx` | devices UI |
| `src/app/(app)/device/dashboard/add.tsx`, `details.tsx`, `placeWidget.tsx`, `src/components/device/widgets/WidgetView.tsx`, `WidgetList.tsx`, `WidgetListTile.tsx`, `widgets/widgets/{Button,Slider,Switch,Color,Radio}Widget.tsx`, `src/app/(app)/device/widget/add.tsx`, `details.tsx` | dashboards + widgets UI |
| `src/app/(app)/device/operation/add.tsx`, `details.tsx`, `src/components/device/operation/OperationList.tsx`, `OperationSelector.tsx`, `src/components/automations/conditions/AutomationConditionForm.tsx`, `src/components/automations/results/AutomationResultForm.tsx` | operations UI |
| `AGENTS.md` | migration note |

---

### Task 1: JSON ⇄ Value helpers and devices + deviceSharing routes

**Files:** `src/api/json.ts`, `tests/api/json.test.ts`, `src/api/transport/rest/routes/devices.ts`, `deviceSharing.ts`, `index.ts`, `tests/api/transport/rest/routes/devices.test.ts`, `deviceSharing.test.ts`; converters additions if needed (`boolOrUndefined`, `structFromJson(v): JsonObject` returning `{}` for null/non-object).

**Interfaces:** `toProtoValue(json)` uses `fromJson(ValueSchema, json ?? null)`; `fromProtoValue(v)` uses `toJson(ValueSchema, v)` and returns `null` when `v` undefined. Routes consume `seg`, `idResponse`, `items`, `query`, `timestampFromIso`, `strOrUndefined`.

- [ ] Tests first (RED): json helpers (string/number/bool/null/object round-trip; undefined → null); devices routes — "covers every RPC"; `createDevice` body with `roomId` unset → key absent, `roomId: ""` → `null`; `updateDevice` body rules (each omit/null rule from the table, one assertion each); `displayDevices` query omits 0 page/size; `displayDevice`/`deviceTileAction` responses wrap as `{ device }` and map `tile.value: true` → Value `boolValue`, `tile.value: null` → `nullValue`, `tile.configuration: null` → `{}`, `presence.lastSeenAtUtc` ISO → Timestamp, `roomId: null` → undefined; `getDevice` response maps nulls to unset and null configuration → `{}`; deviceSharing three routes.
- [ ] Implement; register both tables in `index.ts`; GREEN; prettier; lint; typecheck; commit `feat: rest routes for devices and device sharing with json value helpers`.

### Task 2: dashboards, operations, widgets routes

**Files:** `routes/dashboards.ts`, `operations.ts`, `widgets.ts`, `index.ts`, three test files.

- [ ] Tests first: coverage test per service; `updateDashboard` body drops empty name/icon; `setWidgetOnDashboard` body field names camelCase; `displayDashboard` response `{ type, configuration }` with configuration passthrough (object) and `{}` for null; `displayOperations` query with/without page/size; `displayWidgets` response nesting; `widgets.action` body `{ value: <json> }` for string/number/bool and `response: empty`; `widgets.state` body `{ enabled }`.
- [ ] Implement; register; GREEN; commit `feat: rest routes for dashboards, operations and widgets services`.

### Task 3: Device types, mappers and the three providers

**Files:** `src/types/DeviceTypes.tsx`, `tests/types/DeviceTypes.test.ts`, `src/contexts/custom/DeviceListProvider.tsx`, `DeviceProvider.tsx`, `WidgetDetailsProvider.tsx`.

**Interfaces produced:**
```ts
export interface DeviceTile { type: string; operationId?: string; displayableOperationId?: string; value: unknown; configuration?: Record<string, unknown> }
export interface DevicePresence { type: DevicePresenceType; operationId?: string; value?: boolean | null; lastSeenAtUtc?: string | null }
export interface Device { id: string; roomId?: string; icon: string; name: string; tile: DeviceTile; presence?: DevicePresence; createdAtUtc: string; updatedAtUtc: string }
export const toDevice = (dto: DisplayDeviceDto): Device;          // value via fromProtoValue; timestamps via timestampDate(...).toISOString(), "" when unset
export const toDeviceDetails = (r: GetDeviceResponse): Device;    // tile.value = null, timestamps ""
export const toOperationDto = (r: GetOperationResponse): OperationDto;
export const toWidgetDto = (r: GetWidgetResponse): WidgetDto;
export const toOperationGroups = (r: DisplayWidgetsResponse): OperationGroup[];
export type ListDashboardDto = { id; name; icon; type }; export type DashboardDisplayDto = { type: string; configuration: Record<string, unknown> };
```
`DeviceListProvider` re-exports `Device`, `OperationListDto` names it exported before (keep import compatibility for the 8 components fixed in PR 1, which import `OperationType` from `@/types/DeviceTypes` and `OperationListDto` from the provider).

- [ ] Mapper tests (RED → GREEN): `toDevice` full dto, unset optionals, `value` bool/number/string/null; `toDeviceDetails`; `toOperationGroups` nesting.
- [ ] `DeviceListProvider`: `refreshDevice(deviceId)` → `call(() => api.devices.displayDevice({ deviceId }))` → `toDevice(r.data!.device!)`, failure `console.error` only; device list → `call(() => api.devices.displayDevices({ homeId }))` → `items.map(toDevice)`; `isNotFound(r)` → `setDevices([])` + `console.warn`; other failure `toast.apiError(r)` + empty list.
- [ ] `DeviceProvider`: dashboards list (two sites) → `api.dashboards.displayDashboards({ deviceId })`; `isNotFound` → empty + `currentDashboardId=""` silent; other → `toast.apiError`. Dashboard display (two sites) → `api.dashboards.displayDashboard({ dashboardId })` → `{ type, configuration: structToJson(configuration) }`; failure `console.error` only.
- [ ] `WidgetDetailsProvider`: `api.operations.getOperation({ operationId })` → `toOperationDto`; `api.widgets.getWidget({ widgetId })` → `toWidgetDto`; failures `toast.apiError(r)` (and return where the old code returned).
- [ ] Lint/typecheck/test; commit `feat: device providers use devices api clients`.

### Task 4: Device screens and tiles

**Files:** `src/app/(app)/device/add.tsx`, `details.tsx`, `src/components/device/tile/DisplayDeviceTile.tsx`, `SwitchDeviceTile.tsx` (+ `DeviceForm.tsx` only if its output type must change).

- [ ] `add.tsx`: `callSimple(() => api.devices.createDevice({ homeId, roomId: roomIdOrEmpty, name, icon }), "Failed to add device.")` where `"None"` → `""` (route turns `""` into JSON `null`, unset into omitted — today the form sends `null` for "None", so pass `""`); success toast unchanged; failure `toast.apiError(result)`.
- [ ] `details.tsx` update: build `UpdateDeviceRequest` from the form's partial object: unchanged string fields → `""` (route omits), `roomId`/`operationId`/`displayableOperationId`: undefined → unset, `null` → `""`; `configuration` → object when present; `presenceType`, `presenceOperationId` as the form provides (undefined → `""`). Fixed text "Failed to update device.". Delete → `api.devices.deleteDevice`, failure `toast.apiError`. Load → `call(() => api.devices.getDevice({ deviceId }), "Failed to load device details.")` → `toDeviceDetails`; reads unchanged (`tile.configuration?.unit`, `presence?.type`, …).
- [ ] `DisplayDeviceTile` / `SwitchDeviceTile` refresh: `call(() => api.devices.displayDevice({ deviceId }))` → `toDevice(data.device!)`; `isNotFound(result)` → `toast.error("Failed to update device tile. Please refresh.")`; other failures silent (as today); exception path keeps "Failed to update device tile.". Switch action: `callSimple(() => api.devices.deviceTileAction({ deviceId, value: toProtoValue(!isOn) }))`; failure `toast.apiError`; exception text unchanged.
- [ ] Lint/typecheck/test; commit `feat: device screens and tiles use devices api clients`.

### Task 5: Dashboards and widgets UI

**Files:** `src/app/(app)/device/dashboard/add.tsx`, `details.tsx`, `placeWidget.tsx`, `src/app/(app)/device/widget/add.tsx`, `details.tsx`, `src/components/device/widgets/WidgetView.tsx`, `WidgetList.tsx`, `WidgetListTile.tsx`, `widgets/widgets/ButtonWidget.tsx`, `SliderWidget.tsx`, `SwitchWidget.tsx`, `ColorWidget.tsx`, `RadioWidget.tsx`.

- [ ] dashboard `add.tsx`: `api.dashboards.createDashboard({ deviceId, name, icon, configuration: { rows, columns } })`; success toast unchanged; failure `toast.apiError`.
- [ ] dashboard `details.tsx`: update `api.dashboards.updateDashboard({ dashboardId, name: name ?? "", icon: icon ?? "" })` with "Failed to update dashboard."; delete with "Failed to remove dashboard."; load `call(() => api.dashboards.getDashboard({ dashboardId }), "Failed to load dashboard details.")` → `{ id, name, icon, type, configuration: structToJson(...) }`.
- [ ] `placeWidget.tsx`: `api.dashboards.setWidgetOnDashboard({ dashboardId, widgetId, row, rowSpan, column, columnSpan })` with "Failed to place widget: area is overlapping or out of bounds.".
- [ ] widget `add.tsx`: `api.widgets.createWidget({ operationId, name, type, configuration })`; widget `details.tsx` delete with "Failed to remove widget.".
- [ ] `WidgetView.tsx`: `api.dashboards.deleteDashboardWidget({ dashboardId, widgetId })`; success toast unchanged; failure `toast.apiError`; exception text unchanged.
- [ ] `WidgetList.tsx`: `call(() => api.widgets.displayWidgets({ deviceId }), "Failed to load operations.")` → `toOperationGroups`; `isNotFound` → `setGroups([])` + `toast.info("Create some operations!")`; refresh site uses "Failed to refresh operations.".
- [ ] `WidgetListTile.tsx`: `api.widgets.state({ widgetId, enabled: !enabledState })`.
- [ ] Five widget controls: `callSimple(() => api.widgets.action({ widgetId: widget.id, value: toProtoValue(<same value as today>) }))`; failure `toast.apiError(result)`; exception texts unchanged ("Failed to toggle switch.", "Failed to change option.").
- [ ] Lint/typecheck/test; commit `feat: dashboard and widget screens use api clients`.

### Task 6: Operations UI, automation forms, docs, guards

**Files:** `src/app/(app)/device/operation/add.tsx`, `details.tsx`, `src/components/device/operation/OperationList.tsx`, `OperationSelector.tsx`, `src/components/automations/conditions/AutomationConditionForm.tsx`, `src/components/automations/results/AutomationResultForm.tsx`, `AGENTS.md`.

- [ ] operation `add.tsx`: `api.operations.createOperation({ deviceId, name, topic, type, configuration })`. `details.tsx`: delete `api.operations.deleteOperation`; load `call(() => api.operations.getOperation({ operationId }), "Failed to load operation details.")` → `toOperationDto`.
- [ ] `OperationList.tsx`: `call(() => api.operations.displayOperations({ deviceId, page: 0, size: 0 }), "Failed to load operations.")` → items `{id,name,type}`; `isNotFound` → `[]` + `toast.info("Create some operations!")`; refresh site "Failed to refresh operations.".
- [ ] `OperationSelector.tsx`: `displayOperations({ deviceId, page: 1, size: 100 })`; `isNotFound` → `[EmptyOption]`; other failure `toast.apiError(result)` with "Failed to load operations." passed to `call`.
- [ ] `AutomationConditionForm.tsx` / `AutomationResultForm.tsx`: same `displayOperations({ deviceId, page: 0, size: 0 })`; `isNotFound` → `[]` + `toast.info("Create some operations!")`; other failure: condition form "Failed to load operations.", result form `toast.apiError(result)` bare.
- [ ] `AGENTS.md`: migration note "Migrated: devices, dashboards, operations, widgets (PR 5)". Grep guards: `grep -rn "v1/devices" src` → only `src/api/transport/rest/routes` and `src/api/gen`; `grep -rln "useHttpClient" src` → only `HttpClientProvider.tsx`, `home/details.tsx`, automations module files, datasources module files.
- [ ] Lint/typecheck/test; smoke on emulator if available (device list, add/edit device, tiles, dashboards, widgets, operations); commit `feat: operation screens and automation operation pickers use api clients`.

## Self-review
- Every `v1/devices…` endpoint (25 + 3 sharing) has a route (T1–T2) and each app call site (28) a migration (T3–T6). Sharing has no consumer by design.
- Names consistent: `toProtoValue/fromProtoValue/structToJson` (T1) used by T3–T5; `toDevice/toDeviceDetails/toOperationDto/toWidgetDto/toOperationGroups` (T3) used by T3–T6; `isNotFound`, `seg`, `idResponse` come from the PR-4 fix wave.
- No placeholders; per-site rules are explicit; route rows carry exact bodies.
