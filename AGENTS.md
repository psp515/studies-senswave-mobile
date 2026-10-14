# Overview

Senswave is a Smart Home platform for DIY devices.

- **DataSources** — MQTT brokers that send data to the system; system parses and stores it
- **Devices** — hardware units with **Operations** (functions) and **Widgets** (UI controls on dashboards)
- **Homes** — aggregate Devices in Rooms; can be shared with RBAC
- **Automations** — trigger Operations automatically when conditions are met
- **Dashboards** — configurable UI with widgets per device

## Home Roles (RBAC)

| Role | Permissions |
|------|-------------|
| Display | View and act in Home |
| Manage | Display + manage Home settings |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native 0.81.5 + Expo ~54 |
| Routing | Expo Router (file-based) |
| Language | TypeScript 5.9 (strict mode) |
| State | Context API + custom hooks |
| Real-time | SignalR (`@microsoft/signalr` 8.x) |
| Auth storage | `expo-secure-store` |
| Backend | .NET Minimal API — modular monolith (`Senswave.sln`) |

Current app version: **1.1.0**

---

## Project Structure

```
src/
  app/                        # Expo Router file-based routes
    (app)/                    # Authenticated routes
      home/                   # list, add, details, join, share
        room/                 # add, details
      device/                 # add, details, device.tsx
        dashboard/            # add, details, list, placeWidget
        operation/            # add, details, list
        widget/               # add, details, list
      automation/             # add, details, list
        conditions/
        results/
      dataSource/             # add, details, list
        brokers/
      user/                   # info, profile, privacy, terms
    login.tsx
    register.tsx
    confirmEmail.tsx
    forgotPassword.tsx
    resetPassword.tsx
    start.tsx
    server.tsx
    consents.tsx
    maintenance.tsx
    privacy.tsx / terms.tsx

  components/
    common/                   # Shared UI (Button, Text, Dropdown, Loading, Divider, ...)
    auth/
    automations/
    dataSource/
    device/
    headers/
    home/
    homeSharing/
    room/
    user/

  contexts/
    ConfigurationProvider.tsx # API URL, SignalR URL, version check
    SessionProvider.tsx       # Auth state + all auth flows
    ApiProvider.tsx           # Generated Connect clients (useApi) + token refresh
    SignalRProvider.tsx        # SignalR hub connection
    ThemeProvider.tsx
    MenuProvider.tsx
    ModalProvider.tsx
    ToastProvider.tsx
    custom/                   # Feature-level providers
      AutomationListProvider.tsx
      AutomationProvider.tsx
      DeviceListProvider.tsx
      DeviceProvider.tsx
      OperationFormProvider.tsx
      WidgetDetailsProvider.tsx
    domain/                   # Entity providers
      HomeProvider.tsx
      UserProvider.tsx
      LiveUpdateProvider.tsx
      LegalProvider.tsx

  types/
    DeviceTypes.tsx           # OperationType, WidgetType, OperationDto, WidgetDto, ...
    HomeTypes.tsx             # Home, Room, Location, HomeSharingDto, HomeRolesToName
    AutomationsTypes.tsx      # AutomationDto, ConditionType, ConditionConnector
    DataSourcesTypes.tsx      # DataSourceDto, SubscriptionDto, MqttVersion

  utils/
    httpClient.tsx            # executeTimeout, HttpResponse (config version check + Google login only)
    result.tsx                # Result<T>, SimpleResult
    location.tsx
```

---

## Core Types

### Device / Operations

```ts
type OperationType = "Boolean" | "Number" | "Integer" | "Text" | "HexColor" | "Options";
```

Operations define what a device can do. Each operation has a `topic` (MQTT topic) and a `type`.  
Operations of type `Options` have a configurable list of allowed string values (edited via `OptionsOperationFormModal`).  
`HexColor` stores color as hex string. `Number`/`Integer` support decimal separator config.

### Widgets

```ts
type WidgetType = "Invalid" | "Empty" | "Button" | "Display" | "Switch" | "Radio" | "Slider" | "Color";
```

Each widget binds to an Operation. Widget behaviour per type:

| Widget | OperationType | Behaviour |
|--------|--------------|-----------|
| Button | Any | Sends configured value on press |
| Display | Any | Shows current value read-only |
| Switch | Boolean | Toggle true/false |
| Radio | Options | Select from option list (modal picker) |
| Slider | Number / Integer | Range slider with configured min/max |
| Color | HexColor | Full color picker (reanimated-color-picker) |
| Empty | — | Placeholder slot on dashboard grid |
| Invalid | — | Misconfigured widget fallback |

### OperationType → ConditionType mapping (Automations)

```ts
const OperationToConditionMap: Record<OperationType, ConditionType> = {
    Boolean: "BooleanCondition",
    Number:  "NumberCondition",
    Integer: "NumberCondition",
    Text:    "TextCondition",
    HexColor:"TextCondition",
    Options: "TextCondition",
};
```

### Automation

```ts
type ConditionType = "BooleanCondition" | "NumberCondition" | "TextCondition" | "InvalidCondition";
type ConditionConnector = "And" | "Or";  // how conditions are joined
```

Automation has many `conditions` and many `results`. All conditions joined by one `conditionConnector`. Results define which operations fire and with what value.

### DataSource / Subscriptions

```ts
type MqttVersion = "MqttV5" | "MqttV311" | "MqttV310";

type DataSourceDto = { id, name, url, clientName, port, mqttVersion, tls };
type SubscriptionDto = { id, topic };                // MQTT topic subscription on a broker
type CreateSubscriptionRequest = { topic };
```

DataSources are MQTT brokers. Each has subscriptions (MQTT topics). Topic data is parsed using JSON path selectors (configured per Operation) to extract values.

### Home

```ts
interface Home { id, name, icon, isOwner, dataSource: HomeDataSource, location: Location, rooms: Room[] }
interface HomeDataSource { id, name, state }  // state updated via SignalR
```

Home roles: `Display` (view + act), `Manage` (view + act + configure).

### User

```ts
enum ThemeMode { Light = "light", Dark = "dark", Default = "default" }
interface UserData { language, theme, email, name, image?, hasActiveConsent? }
```

`name` derived from email: first char uppercased + rest before `@`. Theme `Default` = system theme.

### Result pattern

```ts
// Simple success/failure
SimpleResult.success() / SimpleResult.failure("message")

// With typed data
Result.success<T>(data) / Result.failure<T>("message") / Result.failureWithData<T>("message", data)
```

---

## API Layer

- `useApi()` from `ApiProvider` is the only API layer. It exposes Connect clients generated from
  backend protos (`src/api/gen`, never edit). Transport chosen by `EXPO_PUBLIC_TRANSPORT_MODE`; the
  REST transport maps RPCs to REST routes in `src/api/transport/rest/routes/`.
- Provider order: Configuration > AnonymousApi > Legal > Session > Theme > Api > SignalR > User.
- Wrap every call with `call()` / `callSimple()` from `src/api/call.ts` to get `Result<T>` /
  `SimpleResult`. Show failures with `toast.apiError(result)` (bare; fixed wording goes into
  `call()`); use `isNotFound(result)` for 404-as-empty cases. No `Code` imports in UI.
- 15s request timeout; auto token refresh on 401 (retry once with new token), handled by `ApiProvider`.
- `PermissionDenied` (HTTP 403) → logout (LegalMiddleware: missing user consents — user hasn't accepted latest Terms/Privacy)
- **Never** call `fetch` directly outside `httpClient.tsx` and `src/api/transport/rest/`
- Callers must consume api errors only through `call()` / `callSimple()` / `toApiError()`; never inspect a raw caught error.
- REST path params must go through `seg()`; list responses through `items()`.
- API path prefix: `/api/v1/...` (built by `ConfigurationProvider.getApiUrl`)

### Key API endpoints by feature

These are the REST routes behind the generated clients (called via `useApi()`, not directly).

| Feature | Endpoint | Method |
|---------|----------|--------|
| User data | `v1/users` | GET |
| User settings | `v1/users/settings` | PATCH |
| Delete account | `v1/users/account` | DELETE |
| Make consents | `v1/users/consents` | POST |
| Terms | `v1/legal/terms` | GET |
| Privacy | `v1/legal/privacy` | GET |
| API version | `v1/version` | GET |

### Consent flow

1. User logs in → redirected to `/consents`
2. App fetches `users.getUser` via `useApi()` → checks `hasActiveConsent`
3. If false → show Terms + Privacy → `users.createConsents` via `useApi()` (REST route `POST v1/users/consents`)
4. If API returns `PermissionDenied` (HTTP 403 over REST) at any point → logout (consent expired/revoked)
5. Legal docs served from API (versioned, with summary + full content in markdown)

---

## Authentication

- Email/password login
- Google OAuth login (`v1/auth/login/google`) — always forces `rememberMe`
- Register with email confirmation flow
- Forgot password / reset password
- Token storage: `expo-secure-store` (access + refresh tokens) when `rememberMe` enabled
- Token type: Bearer JWT
- On app start: checks API compatibility, then tries auto-login via stored refresh token
- After any successful login → redirect to `/consents` (consent check gate)

### Auth API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `v1/auth/login` | POST | Email/password login |
| `v1/auth/login/google` | POST | Google OAuth login |
| `v1/auth/register` | POST | Register new account |
| `v1/auth/refresh` | POST | Refresh access token |
| `v1/auth/confirmEmail` | GET | Confirm email with userId + code |
| `v1/auth/resendConfirmationEmail` | POST | Resend confirmation email |
| `v1/auth/forgotPassword` | POST | Send reset email |
| `v1/auth/resetPassword` | POST | Reset password with code |

### Login status codes

| Code | Meaning |
|------|---------|
| 401 `NotAllowed` | Email not confirmed — show resend button |
| 401 other | Invalid credentials |
| 500 | Server unavailable |

---

## Real-time (SignalR)

Hub endpoint: `signalr/liveupdates/live`

- Connects when user is authenticated
- Auth via `accessTokenFactory` returning current `accessToken`
- On failure: refreshes token, retries after 15s
- Context: `useSignalR()` → `{ data: { connection? } }`

### Invoked methods (client → server)

| Method | Args | When |
|--------|------|------|
| `Initialize` | `homeId: string` | On active home change — subscribes to that home's updates |

### Received events (server → client)

Listened on `"Update"` event with signature `(updateType: string, data: any)`:

| `updateType` | `data` shape | Effect |
|---|---|---|
| `deviceTileActionUpdate` | `{ deviceId }` | Calls per-device registered callback (dashboard tile refresh) |
| `widgetsActionUpdate` | `{ deviceId }` | Triggers `device.smartRefresh(deviceId)` |
| `dataSourceStateUpdate` | `{ dataSourceId, state }` | Updates DataSource state in active home |

Also: `"AccessNotGrantedToHome"` event `(homeId, message)` — logged, no redirect.

Context: `useLiveUpdate()` — exposes `addDeviceTileCallback(deviceId, cb)` and `addHomeDataSourceCallback(cb)`.

---

## Notable Common Components

| Component | Purpose |
|-----------|---------|
| `JsonPathSelector` | Lets user define JSON field path list for parsing MQTT messages. Validates: no `"` or `\`, no control chars, max 64 chars per key |
| `Icon` | Wrapper around `@expo/vector-icons` with a curated icon set |
| `Modal` | Generic modal wrapper using `ModalProvider` |
| `PasswordInput` | Secure text input with show/hide toggle, used in all auth forms |
| `SafetyNote` | Info/warning callout shown in forms for user guidance |
| `Expander` | Collapsible section used in Home details (sharing list, rooms, etc.) |
| `Dropdown` | Selection component used in profile (theme, language) |
| `HorizontalSelector` | Tab-style horizontal option picker |
| `LocalizationSelector` | Language picker |
| `SimpleItemList` | Generic list for simple key-value displays |
| `UserProfileImage` | User avatar derived from email initial |

---

## Environment Variables

| Variable | Description | Default (template) |
|----------|-------------|-------------------|
| `EXPO_PUBLIC_ENVIRONMENT` | `Development` or production | `Development` |
| `EXPO_PUBLIC_SENSWAVE__API__URL` | Backend base URL | `http://10.0.2.2:8080` (Android emulator) |
| `EXPO_PUBLIC_API_GOOGLE_CLIENT_ID` | Google OAuth API client ID | — |
| `EXPO_PUBLIC_MINIMAL_API_VERSION` | Minimum compatible API version | `1.0.0` |
| `EXPO_PUBLIC_CONTACT_EMAIL` | Support email shown in app | `contact@senswave.net` |
| `EXPO_PUBLIC_TRANSPORT_MODE` | API transport: Rest, Grpc (Android native) or GrpcWeb; must match backend Transport:Mode | `Rest` |
| `SENSWAVE_BACKEND_PROTO_DIR` | Local backend proto dir for `npm run proto:sync` (dev tooling only) | — |

Create `.env` from `.env.template` before first run.

---

## Development

### Prerequisites

- Node.js + npm
- Android Studio + Java 17
- Expo CLI

### Commands

```bash
npm i                       # install packages
npx expo run:android        # first build (compiles native code)
npm start                   # subsequent runs (after first build)
npm run lint                # ESLint check
npm run fix                 # ESLint auto-fix
```

- Always verify backend build at `Senswave.sln` level when touching shared contracts
- URL override for dev: `ConfigurationProvider.overrideUrl(url)` — only works when `EXPO_PUBLIC_ENVIRONMENT=Development`

---

## Naming Conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Components | PascalCase | `DeviceForm.tsx` |
| Context providers | PascalCase + "Provider" | `SessionProvider.tsx` |
| Custom hooks | camelCase + "use" prefix | `useSession`, `useDeviceList` |
| Routes / utils / styles | camelCase | `add.tsx`, `httpClient.tsx` |
| Type files | PascalCase | `DeviceTypes.tsx` |
| Props interfaces | PascalCase | `interface DeviceFormProps` |
| Callbacks | `onPress`, `onSubmit`, `setValue` | — |

---

## Component Conventions

- All functional components typed with `FC` or `FC<Props>`
- Props always typed with interfaces
- Styling via `StyleSheet.create()` + theme colors from `useTheme()`
- Path alias `@/*` → `./src/*`; Babel alias `@components` → `./src/components`
- Local UI/form state: `useState`
- Re-fetch trigger: increment a numeric state counter

---

## EAS Build Profiles

| Profile | Distribution | Android type | Notes |
|---------|-------------|--------------|-------|
| development | internal | APK | Dev client enabled |
| localpreview | internal | APK | Extends preview |
| preview | internal | — | Auto-increments version |
| production | store | — | Auto-increments version; manual only |

App version source: `remote` (EAS manages it).

---

## CI / GitHub Workflows

| Workflow | Trigger |
|----------|---------|
| `build.yaml` | Every pull request |
| `build-expo-preview.yaml` | Preview build |
| `build-expo-production.yaml` | Production build (manual) |

### Pull Request Rules

- Notify if tests fail; do **not** merge autonomously
- Commit/PR title format:
  - `fix: <description>` — bug fix
  - `feat: <description>` — new feature
  - `chore: <description>` — maintenance

---

## Versioning

Format: `{major}.{minor}.{patch}`

| Change | Forces update |
|--------|--------------|
| major differs | Always |
| minor differs | Always |
| patch: `appPatch > apiPatch` | Yes |

Env var controlling minimum API version: `EXPO_PUBLIC_MINIMAL_API_VERSION`.
Forced update also possible via Play Store.

---

## Production Updates

- Created **manually only** with strict versioning
- No automated production deploys
