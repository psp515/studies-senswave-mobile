# Transport Migration — Automations, DataSources, remove HttpClientProvider (PR 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every remaining `useHttpClient()` call (automations module, datasources module, `home/details.tsx` broker lookup) onto `useApi()`, then delete `HttpClientProvider`, `toast.httpError` and the `ListResponse` type. After this PR the only raw HTTP left is `ConfigurationProvider.isAppCompatibleWithApi()` and `SessionProvider.loginGoogle()`.

**Architecture:** Same template as PRs 4–5 (`seg`, `idResponse`, `items`, `query`; `call()/callSimple(fn, "<old text>")`, `toast.apiError(result)` bare, `isNotFound(result)` only where the old code branched on 404). Automations use proto enums (`ConditionConnector`, `ConditionType`) and `Struct`/`Value`; mappers in `src/types/AutomationsTypes.tsx` convert generated messages to the existing local DTOs so UI components stay unchanged.

**Tech Stack:** Expo 54, TS strict, `@connectrpc/connect` 2.2, `@bufbuild/protobuf` 2.16, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md` (§2a, §5)

## Global Constraints

- `npm run typecheck`, `npm run lint`, `npm test` green after every task. Prettier 4-space, double quotes, trailing commas, width 100. Components `FC`.
- Template rules from PR 4 final review are binding (see PR 5 plan Global Constraints): `seg()` for path params, `idResponse`, `items()`, `query()` with `x || undefined` only for page/size, fixed wording into `call()`, `toast.apiError(result)` bare, `isNotFound()`, no `Code` imports in UI, no `id as string` casts for path params.
- Public context APIs (`useAutomationList()`, `useAutomationDetails()`) keep method names/return types; screen behaviour unchanged except where stated; fixed strings keep today's wording (quoted below).
- At the end of this PR: `grep -rn "useHttpClient\|HttpClientProvider\|toast.httpError\|ListResponse" src` returns nothing; `src/contexts/HttpClientProvider.tsx` deleted; `executeTimeout` remains only for `ConfigurationProvider` and `loginGoogle`.
- Commits `feat:` / `fix:` / `chore:` ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env` or `.superpowers/`.
- Branch `feat/transport-6-automations-datasources` based on `feat/transport-5-devices` (after its fix wave). Working dir `E:\ssm`.

## Backend REST contract

### Automations (`AutomationsService`, `@/api/gen/automations/v1/automations_pb`)

Proto enums ⇄ REST strings: `ConditionConnector.AND`→`"And"`, `.OR`→`"Or"`, `UNSPECIFIED`→`""`; `ConditionType.BOOLEAN`→`"BooleanCondition"`, `.NUMBER`→`"NumberCondition"`, `.TEXT`→`"TextCondition"`, `UNSPECIFIED`→`""`. REST may return `"Empty"`/`"Invalid"` → map to `UNSPECIFIED`. `conditionConfiguration` = `Struct` (JSON object: `{isOn}`, `{minValue,maxValue}`, `{requiredValue}`); `valueToSend` = `Value` (JSON scalar). Response `AutomationModel`: `{ id, homeId, name, icon, conditionConnector, isEnabled, conditions: [{ id, operationId, operationName, conditionType, conditionConfiguration }], results: [{ id, operationId, operationName, valueToSend }] }`.

| RPC | REST | Body | Response |
|---|---|---|---|
| createAutomation `{homeId, name, icon, conditionConnector, conditions[], results[]}` | POST `v1/automations` | `{ homeId, name, icon, conditionConnector: str, conditions: [{operationId, conditionType: str, conditionConfiguration}], results: [{operationId, valueToSend: json}] }` | 201 `{id}` → `IdResponse` |
| getAutomation `{automationId}` | GET `v1/automations/{automationId}` | — | `AutomationModel` unwrapped → `{ automation: model }` |
| updateAutomation `{automationId, name, icon, conditionConnector, conditions[], results[]}` | PATCH `v1/automations/{automationId}` | `{ name?, icon?, conditionConnector?, conditions?, results? }` — send `name`/`icon` only when non-empty, `conditionConnector` only when not UNSPECIFIED, arrays only when non-empty | 204 |
| deleteAutomation `{automationId}` | DELETE `v1/automations/{automationId}` | — | 204 |
| displayAutomations `{homeId}` | GET `v1/automations/display?homeId=` | — | `{ items: AutomationModel[] }` (200 with `[]` when empty; 404 only when home missing) |
| automationState `{automationId, isEnabled}` | PUT `v1/automations/{automationId}/state` | `{ isEnabled }` | 204 |
| putConditionToAutomation `{automationId, operationId, conditionType, conditionConfiguration}` | PUT `v1/automations/conditions/{automationId}` | `{ operationId, conditionType: str, conditionConfiguration }` | 200 empty |
| putResultToAutomation `{automationId, operationId, value: string}` | PUT `v1/automations/results/{automationId}` | `{ operationId, value }` | 200 empty |
| deleteCondition `{conditionId}` | DELETE `v1/automations/conditions/{conditionId}` | — | 204 |
| deleteResult `{resultId}` | DELETE `v1/automations/results/{resultId}` | — | 204 |

### DataSources (`DataSourcesService`, `@/api/gen/datasources/v1/datasources_pb`; RPC names keep the backend spelling `CreateSubscribtion`, `DeleteSubscribtion`, `GetSubscribtions`)

Enums are plain strings. Timestamps: REST `createdAt`/`updatedAt` (brokers, subscriptions), `createdAtUtc`/`updatedAtUtc` (sessions, logs) → `Timestamp`.

| RPC | REST | Body | Response |
|---|---|---|---|
| getBrokers `{page, size}` | GET `v1/datasources/brokers?page=&size=` | — | `{ items: [{ id, name, server, createdAt, updatedAt }] }` (404 when empty) |
| getBroker `{brokerId}` | GET `v1/datasources/brokers/{brokerId}` | — | `{ id, name, url, protocolVersion, clientName, port, useTls, createdAt, updatedAt }` |
| createBroker `{name, url, clientName, port, protocolVersion, useTls, username, password}` | POST `v1/datasources/brokers` | same keys | 201 `{id}` |
| updateBroker `{brokerId, name, url, clientName, port?, protocolVersion, useTls?, username, password}` | PATCH `v1/datasources/brokers/{brokerId}` | `{ name, url, clientName, port: <omit when unset>, protocolVersion, useTls: <omit when unset>, username, password }` | 204 |
| deleteBroker `{brokerId}` | DELETE `v1/datasources/brokers/{brokerId}` | — | 204 |
| getClientState `{brokerId}` | GET `v1/datasources/brokers/{brokerId}/clients` | — | `{ connectionStatus, latestSessionId }` |
| startClient `{brokerId, username, password}` | POST `v1/datasources/brokers/{brokerId}/clients` | `{ username, password }` | 204 |
| stopClient `{brokerId}` | DELETE `v1/datasources/brokers/{brokerId}/clients` | — | 204 |
| restartClient `{brokerId}` | PATCH `v1/datasources/brokers/{brokerId}/clients/restart` | `{}` | 204 |
| getSubscribtions `{brokerId, page, size}` | GET `v1/datasources/brokers/{brokerId}/subscriptions?page=&size=` | — | `{ items: [{ id, topic, createdAt, updatedAt }] }` (404 when empty) |
| createSubscribtion `{brokerId, topic}` | POST `v1/datasources/brokers/{brokerId}/subscriptions` | `{ topic }` | 201 `{id}` |
| deleteSubscribtion `{brokerId, subscriptionId}` | DELETE `v1/datasources/brokers/{brokerId}/subscriptions/{subscriptionId}` | — | 204 |
| getSessions `{brokerId, page, size}` | GET `v1/datasources/brokers/{brokerId}/sessions?page=&size=` | — | `{ items: [{ id, updatedAtUtc, createdAtUtc, finished }] }` (404 when empty) |
| getSession `{brokerId, sessionId}` | GET `v1/datasources/brokers/{brokerId}/sessions/{sessionId}` | — | `{ id, logs: [{ id, eventType, data, createdAtUtc }], createdAtUtc, updatedAtUtc }` |

---

## File map

| File | Responsibility |
|---|---|
| `src/api/transport/rest/routes/automations.ts`, `dataSources.ts` + tests; `index.ts` | routes |
| `src/types/AutomationsTypes.tsx` | enum string ⇄ proto enum helpers (`connectorFromString/ToString`, `conditionTypeFromString/ToString`), mappers `toAutomationDto(model)`, `toConditionMessage(dto)`, `toResultMessage(dto)`; optional `id` on condition/result DTOs |
| `tests/types/AutomationsTypes.test.ts` | |
| `src/types/DataSourcesTypes.tsx` | fix `DataSourceDto` to `{ id, name, url, clientName, port, protocolVersion: MqttVersion, useTls: boolean }` (today's `mqttVersion`/`tls` fields never matched the backend); `toDataSourceDto(r: GetBrokerResponse)` |
| `src/contexts/custom/AutomationListProvider.tsx`, `AutomationProvider.tsx` | providers |
| `src/app/(app)/automation/add.tsx`, `details.tsx`, `conditions/add.tsx`, `results/add.tsx`, `src/components/automations/AutomationTile.tsx`, `results/AutomationResultForm.tsx` (PUT only; its operations GET was migrated in PR 5) | automations UI |
| `src/app/(app)/dataSource/add.tsx`, `src/components/dataSource/DataSourceList.tsx`, `brokers/BrokerClient.tsx`, `brokers/StartBrokerClientForm.tsx`, `sections/DataSourceDetailsSection.tsx`, `state/DataSourceStateGet.tsx`, `subscriptions/AddSubscriptionForm.tsx`, `subscriptions/BrokerSubscriptions.tsx`, `src/app/(app)/home/details.tsx` | datasources UI |
| delete `src/contexts/HttpClientProvider.tsx`; edit `src/app/_layout.tsx`, `src/contexts/ToastProvider.tsx` (remove `httpError`), `src/utils/httpClient.tsx` (remove `ListResponse`), `AGENTS.md` | cleanup |

---

### Task 1: Automations and DataSources routes

- [ ] Tests first (RED), per service: "covers every RPC"; `automations`: enum string mapping both directions incl. `"Empty"`→UNSPECIFIED; `createAutomation` body with nested conditions/results (`conditionConfiguration` object passthrough, `valueToSend` via `toJson(ValueSchema, …)`); `getAutomation` response wrapped `{ automation }` with `conditions[].id`, `results[].valueToSend` → `Value`; `updateAutomation` partial body rules; `putResultToAutomation` body `{ operationId, value }`; `displayAutomations` query. `dataSources`: all 14 rows; `getBrokers`/`getSubscribtions`/`getSessions` omit page/size when 0; `updateBroker` omits `port`/`useTls` when unset; `restartClient` body `{}`; timestamps via `timestampFromIso`; empty-id `seg` tests.
- [ ] Implement (`automations.ts` keeps the enum helpers local to the route file or imports them from `src/types/AutomationsTypes.tsx` — choose the types file so UI shares them); register in `index.ts`; GREEN; commit `feat: rest routes for automations and datasources services`.

### Task 2: Automations types, mappers and providers

- [ ] `AutomationsTypes.tsx`: keep `ConditionType`/`ConditionConnector` string unions; add `id?: string` to `AutomationConditionDto`/`AutomationResultDto`; add helpers (`connectorToProto(s): ConditionConnector(enum)`, `connectorFromProto(e): string`, same for condition type), `toAutomationDto(model: AutomationModel): AutomationDto` (`conditionConfiguration: structToJson(...)`, `valueToSend: fromProtoValue(...)`), `toConditionMessage(dto)`, `toResultMessage(dto)` (`valueToSend: toProtoValue(dto.valueToSend)`). Tests: round-trips and a full model mapping.
- [ ] `AutomationListProvider`: `call(() => api.automations.displayAutomations({ homeId }))` → `items.map(toAutomationDto)`; `isNotFound` → `console.warn` + `[]` + return false (today's branch); other failure `toast.apiError`.
- [ ] `AutomationProvider`: `call(() => api.automations.getAutomation({ automationId }))` → `toAutomationDto(data.automation!)`; `isNotFound` → clear silently; other → `toast.apiError`.
- [ ] Commit `feat: automation providers use automations api client`.

### Task 3: Automations screens and components

- [ ] `automation/add.tsx`: build `CreateAutomationRequest` from form values (`conditions.map(toConditionMessage)`, `results.map(toResultMessage)`, `conditionConnector: connectorToProto(...)`; `isEnabled` dropped — backend ignores it); `callSimple(…, "Failed to add automation.")`; success unchanged.
- [ ] `automation/details.tsx`: load with "Failed to load automation details."; delete "Failed to delete automation."; state → `callSimple(() => api.automations.automationState({ automationId, isEnabled }))` (result ignored as today); update → `UpdateAutomationRequest` with `""`/UNSPECIFIED/`[]` for untouched fields (route omits them), "Failed to update automation.".
- [ ] `conditions/add.tsx`: `putConditionToAutomation({ automationId, operationId, conditionType: conditionTypeToProto(...), conditionConfiguration })` with "Failed to add automation condition.".
- [ ] `results/add.tsx` / `AutomationResultForm.tsx`: `putResultToAutomation({ automationId, operationId, value: String(valueToSend) })` with "Failed to add automation result."; keep `addResult` local update.
- [ ] `AutomationTile.tsx`: `deleteAutomation`; success text unchanged; failure `toast.apiError`.
- [ ] Commit `feat: automation screens use automations api client`.

### Task 4: DataSources types, screens and components

- [ ] `DataSourcesTypes.tsx`: fix `DataSourceDto` fields (`protocolVersion`, `useTls`), add `toDataSourceDto`; update `DataSourceDetailsSection.tsx` init values to the fixed names (this repairs the existing bug where edit form always fell back to MqttV5/true); `DataSourceForm` already submits `protocolVersion`/`useTls`.
- [ ] `dataSource/add.tsx`: `createBroker({...})` with "Failed to add data source.". `DataSourceDetailsSection.tsx`: update (`updateBroker` with `port`/`useTls` from the form) "Failed to update data source."; delete → `toast.apiError`; load → `toDataSourceDto`, failure `toast.apiError`.
- [ ] `DataSourceList.tsx`: both sites `call(() => api.dataSources.getBrokers({ page: 0, size: 0 }), "Failed to load data sources.")` → local `DataSource` items (timestamps → ISO via `timestampDate`); `isNotFound` → `[]` + `toast.info("Create your first data source.")` on initial load; on refresh `isNotFound` → `[]` silently (fixes today's bogus error toast on empty refresh — state this in the commit body).
- [ ] `BrokerClient.tsx`: `getClientState` ("Failed to load broker client details."), `stopClient` ("Failed to stop broker client."), `restartClient` ("Failed to restart broker client."); guards and success toasts unchanged. `StartBrokerClientForm.tsx`: `startClient({ brokerId, username, password })` ("Failed to start broker client."). `DataSourceStateGet.tsx`: `getClientState` → `connectionStatus`; failure `toast.apiError`.
- [ ] `AddSubscriptionForm.tsx`: `createSubscribtion({ brokerId, topic })`; `BrokerSubscriptions.tsx`: `getSubscribtions({ brokerId, page: 1, size: 400 })` → `items.map(({id, topic}) => ({id, topic}))`; `isNotFound` → `[]` silently (fixes today's error toast on empty list); delete `deleteSubscribtion({ brokerId, subscriptionId })`.
- [ ] `home/details.tsx`: broker lookup → `call(() => api.dataSources.getBroker({ brokerId }), "Failed to load home data source.")` → `toDataSourceDto`; remove `useHttpClient` import.
- [ ] Commit `feat: datasources screens use datasources api client`.

### Task 5: Remove the legacy HTTP client

- [ ] Delete `src/contexts/HttpClientProvider.tsx`; remove `HttpClientProvider` from `src/app/_layout.tsx`; remove `httpError` from `ToastProvider.tsx` (interface, default, impl, `HttpResponse` import); remove `ListResponse` from `src/utils/httpClient.tsx`; grep guards from Global Constraints must be empty; `AGENTS.md`: delete the `useHttpClient` bullets, document `useApi()` as the only API layer, provider order Configuration > AnonymousApi > Legal > Session > Theme > Api > SignalR > User.
- [ ] Lint/typecheck/test; smoke if emulator; commit `chore: remove HttpClientProvider and legacy http helpers`.

## Self-review
- All 10 automations + 14 datasources endpoints have rows (T1) and every call site (automations 7 files, datasources 9 files incl. home/details) a migration (T2–T4). Sessions RPCs have routes but no consumer (as before).
- Names: `toAutomationDto/toConditionMessage/toResultMessage/connectorToProto/conditionTypeToProto` (T2) used in T3 and T1 routes; `toDataSourceDto` (T4); `toProtoValue/fromProtoValue/structToJson` from PR 5 `src/api/json.ts`.
- Cleanup (T5) depends on T2–T4 and on PR 5 having removed all device call sites.
