# Transport Foundation Implementation Plan (PR 1 + PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proto codegen, a REST `Transport` for Connect clients, the shared interceptor chain, the unified error model and an `ApiProvider`, mounted but not yet consumed, so later PRs can migrate call sites module by module.

**Architecture:** Proto files are synced from the backend and compiled with `protoc-gen-es` into `src/api/gen/`. Connect `createClient(Service, transport)` gives typed clients. A custom `RestTransport` maps each RPC to the frozen REST route through a declarative mapping table. Auth / consent / error-normalisation interceptors run inside the transport via `runUnaryCall`, so they apply unchanged to gRPC-Web and native gRPC later.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript 5.9 strict, `@bufbuild/protobuf` v2, `@connectrpc/connect` v2, `@bufbuild/buf`, `@bufbuild/protoc-gen-es`, `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md`

## Global Constraints

- TypeScript strict mode; `npx tsc --noEmit` must pass after every task.
- `npm run lint` (ESLint + Prettier, 4-space indent, double quotes, trailing commas, print width 100) must pass after every task.
- Path alias `@/*` → `./src/*`. Components typed `FC` / `FC<Props>`; props use interfaces.
- Never call `fetch` directly outside `src/utils/httpClient.tsx` and the REST transport (`src/api/transport/rest/`).
- Generated code in `src/api/gen/` and synced protos in `proto/` are committed. Never hand-edit them.
- Existing behaviour must not change in this plan: `HttpClientProvider` stays; `ApiProvider` is mounted but unused by UI.
- Commit messages: `feat:` / `fix:` / `chore:` prefix, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Working directory for all commands: `E:\ssm` (the app repo). Backend protos: `E:\Projects\studies-senswave-backend\src\Shared\Senswave.Contracts\Protos`.
- Branches: PR 1 on `feat/transport-1-scaffolding` (exists, holds the spec). PR 2 on `feat/transport-2-rest-transport` based on PR 1.
- `node_modules` is not installed at plan time. Task 1 runs `npm install` first.

---

## File map

PR 1 (`feat/transport-1-scaffolding`):

| File | Responsibility |
|---|---|
| `jest.config.js` | jest-expo preset, `@/` alias, test match |
| `tests/utils/result.test.ts` | smoke test proving Jest works |
| `scripts/proto-sync.mjs` | copy backend protos into `proto/` |
| `proto/**` | synced proto sources (committed) |
| `buf.yaml`, `buf.gen.yaml` | buf module + codegen config |
| `src/api/gen/**` | generated TS (committed) |
| `tests/api/gen.test.ts` | asserts generated descriptors exist |
| `src/api/transport/TransportMode.ts` | `TransportMode` type + `resolveTransportMode` |
| `tests/api/transport/TransportMode.test.ts` | |
| `src/contexts/ConfigurationProvider.tsx` | add `transportMode`, `overrideTransportMode` |
| `env.d.ts`, `.env.template`, `AGENTS.md` | new env vars documented |

PR 2 (`feat/transport-2-rest-transport`):

| File | Responsibility |
|---|---|
| `src/api/errors.ts` | `ApiError`, `restProblemToErrors`, `toApiError` |
| `tests/api/errors.test.ts` | |
| `src/api/transport/rest/RestRoute.ts` | `RestRoute` type, `RestRouteTable`, registry helpers |
| `src/api/transport/rest/httpStatusToCode.ts` | HTTP status → Connect `Code` |
| `src/api/transport/rest/createRestTransport.ts` | the `Transport` implementation |
| `tests/api/transport/rest/createRestTransport.test.ts` | |
| `src/api/transport/rest/converters.ts` | `timestampFromIso`, `emptyResponse`, `idResponse` |
| `src/api/transport/rest/routes/users.ts`, `legal.ts`, `auth.ts` | mapping rows |
| `src/api/transport/rest/routes/index.ts` | combines route tables |
| `tests/api/transport/rest/routes/*.test.ts` | one test file per module |
| `src/api/interceptors/authInterceptor.ts` | bearer header, refresh + retry once, dedupe |
| `src/api/interceptors/legalInterceptor.ts` | PermissionDenied → logout |
| `src/api/interceptors/errorInterceptor.ts` | ConnectError → ApiError |
| `tests/api/interceptors/*.test.ts` | |
| `src/api/transport/createTransport.ts` | mode → Transport (REST only for now; others throw) |
| `src/api/clients.ts` | `createApiClients(transport)` typed bag |
| `src/api/call.ts` | `call()` → `Result<T>` helper |
| `src/contexts/ApiProvider.tsx` | context, builds transport + clients |
| `src/app/_layout.tsx` | mount `ApiProvider` |

---

# PR 1 — scaffolding

### Task 1: Jest setup

**Files:**
- Create: `jest.config.js`
- Create: `tests/utils/result.test.ts`
- Modify: `package.json` (scripts, devDependencies)

**Interfaces:**
- Produces: `npm test` runs Jest with `@/` alias resolution. All later tests rely on it.

- [ ] **Step 1: Install dependencies**

Run from `E:\ssm`:
```bash
npm install
npm install --save-dev jest-expo jest @types/jest
```
Expected: `node_modules/jest-expo` exists. If npm reports a peer conflict with `jest`, pin `jest@~29.7.0` (jest-expo 54 targets Jest 29).

- [ ] **Step 2: Create jest.config.js**

```js
/** @type {import('jest').Config} */
module.exports = {
    preset: "jest-expo",
    testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@bufbuild/.*|@connectrpc/.*)",
    ],
};
```

- [ ] **Step 3: Add scripts to package.json**

In `"scripts"` add:
```json
"test": "jest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Write smoke test**

`tests/utils/result.test.ts`:
```ts
import { Result, SimpleResult } from "@/utils/result";

describe("Result", () => {
    it("success carries data", () => {
        const r = Result.success(42);
        expect(r.isSuccess).toBe(true);
        expect(r.data).toBe(42);
        expect(r.errorMessage).toBeNull();
    });

    it("failureWithData carries both", () => {
        const r = Result.failureWithData("bad", true);
        expect(r.isSuccess).toBe(false);
        expect(r.data).toBe(true);
        expect(r.errorMessage).toBe("bad");
    });

    it("SimpleResult.failure carries message", () => {
        expect(SimpleResult.failure("x").errorMessage).toBe("x");
    });
});
```

- [ ] **Step 5: Run**

Run: `npm test`
Expected: 3 passed.

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors. If ESLint complains about `jest.config.js`, it is already ignored by `*.config.js` in `eslint.config.cjs`. If `tests/**` has lint errors about `describe`/`it` globals, add to `eslint.config.cjs` a block:
```js
{
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    languageOptions: { globals: { describe: "readonly", it: "readonly", expect: "readonly", jest: "readonly", beforeEach: "readonly", afterEach: "readonly" } },
},
```

- [ ] **Step 7: Commit**

```bash
git add jest.config.js tests/utils/result.test.ts package.json package-lock.json eslint.config.cjs
git commit -m "chore: add jest-expo test setup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Proto sync and codegen

**Files:**
- Create: `scripts/proto-sync.mjs`
- Create: `buf.yaml`, `buf.gen.yaml`
- Create: `proto/**` (synced), `src/api/gen/**` (generated)
- Create: `tests/api/gen.test.ts`
- Modify: `package.json`, `.env.template`, `.gitignore` (no change needed, `.env` already ignored)

**Interfaces:**
- Produces: generated descriptors at `@/api/gen/<module>/v1/<file>_pb` e.g. `HomesService`, `GetHomeRequestSchema`, `ErrorSchema` (from `@/api/gen/common/v1/common_pb`). Later tasks import these.

- [ ] **Step 1: Install codegen deps**

```bash
npm install @bufbuild/protobuf @connectrpc/connect @connectrpc/connect-web
npm install --save-dev @bufbuild/buf @bufbuild/protoc-gen-es
```
Expected: `@bufbuild/protobuf` ≥ 2.2, `@connectrpc/connect` ≥ 2.0, `@bufbuild/protoc-gen-es` ≥ 2.2.

- [ ] **Step 2: Write sync script**

`scripts/proto-sync.mjs`:
```js
// Copies backend proto files into ./proto so the app builds without a backend checkout.
// Source dir comes from SENSWAVE_BACKEND_PROTO_DIR in .env (or the environment).
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
}

const source = process.env.SENSWAVE_BACKEND_PROTO_DIR;
if (!source || !existsSync(source)) {
    console.error("SENSWAVE_BACKEND_PROTO_DIR is not set or does not exist:", source);
    process.exit(1);
}

const target = resolve(process.cwd(), "proto");
rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
    recursive: true,
    filter: (src) => !src.includes("obj") && !src.includes("bin"),
});
console.log(`Synced protos from ${source} to ${target}`);
```

- [ ] **Step 3: Add env var to .env.template and .env**

Append to `.env.template`:
```
# Local path to backend protos, used by `npm run proto:sync` only
SENSWAVE_BACKEND_PROTO_DIR=E:/Projects/studies-senswave-backend/src/Shared/Senswave.Contracts/Protos
```
Create or append the same line to your local `.env` (git-ignored).

- [ ] **Step 4: buf config**

`buf.yaml`:
```yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

`buf.gen.yaml`:
```yaml
version: v2
clean: true
plugins:
  - local: protoc-gen-es
    out: src/api/gen
    opt:
      - target=ts
      - json_types=false
      - import_extension=none
inputs:
  - directory: proto
```

- [ ] **Step 5: Add scripts**

In `package.json` `"scripts"`:
```json
"proto:sync": "node scripts/proto-sync.mjs",
"proto:gen": "buf generate",
"proto": "npm run proto:sync && npm run proto:gen"
```

- [ ] **Step 6: Run sync + gen**

Run: `npm run proto`
Expected: `proto/common/v1/common.proto` ... `proto/users/v1/users.proto` exist (16 files). `src/api/gen/homes/v1/homes_pb.ts`, `src/api/gen/common/v1/common_pb.ts`, `src/api/gen/google/protobuf/struct_pb.ts` and `timestamp_pb.ts` exist. If `buf` complains about missing `google/protobuf/*.proto`, those are well-known types bundled with buf; nothing to add.

- [ ] **Step 7: Exclude generated code from lint and typecheck noise**

In `eslint.config.cjs` `ignores` add `"src/api/gen/**"`. In `tsconfig.json` nothing changes (generated code must typecheck; it does).

- [ ] **Step 8: Write test**

`tests/api/gen.test.ts`:
```ts
import { HomesService } from "@/api/gen/homes/v1/homes_pb";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";

describe("generated proto code", () => {
    it("exposes service descriptors with full type names", () => {
        expect(HomesService.typeName).toBe("senswave.homes.v1.HomesService");
        expect(HomesService.method.getHome.name).toBe("GetHome");
        expect(HomesService.method.getHome.methodKind).toBe("unary");
        expect(LiveUpdatesService.method.subscribe.methodKind).toBe("server_streaming");
    });

    it("round-trips a common Error", () => {
        const err = create(ErrorSchema, {
            code: "NotFound",
            type: ErrorType.NOT_FOUND,
            description: "Home not found",
        });
        const back = fromBinary(ErrorSchema, toBinary(ErrorSchema, err));
        expect(back.code).toBe("NotFound");
        expect(back.type).toBe(ErrorType.NOT_FOUND);
    });
});
```

- [ ] **Step 9: Run**

Run: `npm test -- tests/api/gen.test.ts`
Expected: 2 passed. If Jest fails with `SyntaxError: Cannot use import statement` inside `@bufbuild/protobuf`, confirm the `transformIgnorePatterns` from Task 1 includes `@bufbuild/.*|@connectrpc/.*`.

- [ ] **Step 10: Lint + typecheck + commit**

```bash
npm run lint && npm run typecheck
git add scripts buf.yaml buf.gen.yaml proto src/api/gen tests/api/gen.test.ts package.json package-lock.json .env.template eslint.config.cjs
git commit -m "chore: sync backend protos and generate connect-es clients

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: TransportMode in configuration

**Files:**
- Create: `src/api/transport/TransportMode.ts`
- Create: `tests/api/transport/TransportMode.test.ts`
- Modify: `src/contexts/ConfigurationProvider.tsx`
- Modify: `env.d.ts`, `.env.template`, `AGENTS.md`

**Interfaces:**
- Produces:
  ```ts
  export type TransportMode = "Rest" | "Grpc" | "GrpcWeb";
  export const TransportModes: readonly TransportMode[];
  export function parseTransportMode(value: string | undefined): TransportMode | null;
  export function resolveTransportMode(env: string | undefined, override: string | null, isDevelopment: boolean): TransportMode;
  ```
  `ConfigurationContextType` gains `transportMode: TransportMode` and `overrideTransportMode(mode: TransportMode | null): void`.

- [ ] **Step 1: Write failing test**

`tests/api/transport/TransportMode.test.ts`:
```ts
import { parseTransportMode, resolveTransportMode } from "@/api/transport/TransportMode";

describe("parseTransportMode", () => {
    it("accepts known values case-insensitively", () => {
        expect(parseTransportMode("Rest")).toBe("Rest");
        expect(parseTransportMode("grpcweb")).toBe("GrpcWeb");
        expect(parseTransportMode("GRPC")).toBe("Grpc");
    });
    it("rejects unknown", () => {
        expect(parseTransportMode("soap")).toBeNull();
        expect(parseTransportMode(undefined)).toBeNull();
    });
});

describe("resolveTransportMode", () => {
    it("defaults to Rest", () => {
        expect(resolveTransportMode(undefined, null, false)).toBe("Rest");
    });
    it("uses env when valid", () => {
        expect(resolveTransportMode("GrpcWeb", null, false)).toBe("GrpcWeb");
    });
    it("override wins only in development", () => {
        expect(resolveTransportMode("Rest", "Grpc", true)).toBe("Grpc");
        expect(resolveTransportMode("Rest", "Grpc", false)).toBe("Rest");
    });
    it("ignores invalid override", () => {
        expect(resolveTransportMode("GrpcWeb", "nope", true)).toBe("GrpcWeb");
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/transport/TransportMode.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/api/transport/TransportMode.ts`:
```ts
export type TransportMode = "Rest" | "Grpc" | "GrpcWeb";

export const TransportModes: readonly TransportMode[] = ["Rest", "Grpc", "GrpcWeb"];

export const parseTransportMode = (value: string | undefined | null): TransportMode | null => {
    if (!value) return null;
    const lower = value.toLowerCase();
    return TransportModes.find((m) => m.toLowerCase() === lower) ?? null;
};

export const resolveTransportMode = (
    env: string | undefined,
    override: string | null,
    isDevelopment: boolean,
): TransportMode => {
    if (isDevelopment) {
        const o = parseTransportMode(override);
        if (o) return o;
    }
    return parseTransportMode(env) ?? "Rest";
};
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/api/transport/TransportMode.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Wire into ConfigurationProvider**

In `src/contexts/ConfigurationProvider.tsx`:

Add imports:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { resolveTransportMode, TransportMode } from "@/api/transport/TransportMode";
```

Extend the interface:
```ts
interface ConfigurationContextType {
    getBaseUrl: () => URL;
    getApiUrl: (path: string) => URL;
    getSignalRUrl: (path: string) => URL;
    overrideUrl: (url: string) => void;
    transportMode: TransportMode;
    overrideTransportMode: (mode: TransportMode | null) => void;
    isDevelopment: () => boolean;
    isAppCompatibleWithApi: () => Promise<boolean>;
}
```

Extend the default context value with:
```ts
    transportMode: "Rest",
    overrideTransportMode(): void {
        console.error("[Configuration Context] Not initialized.");
    },
```

Inside the provider, after `const [urlOverride, setUrlOverride] = useState<string>("");` add:
```ts
    const TransportOverrideKey = "configuration.transportModeOverride";
    const [transportOverride, setTransportOverride] = useState<string | null>(null);

    useEffect(() => {
        AsyncStorage.getItem(TransportOverrideKey)
            .then((v) => setTransportOverride(v))
            .catch(() => undefined);
    }, []);

    const overrideTransportMode = (mode: TransportMode | null) => {
        if (!isDevelopment()) {
            console.warn("[Configuration Context] Cannot override transport mode in production mode.");
            return;
        }
        setTransportOverride(mode);
        if (mode) {
            AsyncStorage.setItem(TransportOverrideKey, mode).catch(() => undefined);
        } else {
            AsyncStorage.removeItem(TransportOverrideKey).catch(() => undefined);
        }
        console.info(`[Configuration Context] Transport mode override: ${mode ?? "none"}`);
    };

    const transportMode = resolveTransportMode(
        process.env.EXPO_PUBLIC_TRANSPORT_MODE,
        transportOverride,
        isDevelopment(),
    );
```

Add `transportMode` and `overrideTransportMode` to the `value` object.

- [ ] **Step 6: Env typing and docs**

`env.d.ts` add inside `ProcessEnv`:
```ts
        EXPO_PUBLIC_TRANSPORT_MODE?: string;
```
`.env.template` add:
```
# Rest | Grpc | GrpcWeb — must match the backend Transport:Mode of the target server
EXPO_PUBLIC_TRANSPORT_MODE=Rest
```
`AGENTS.md` Environment Variables table add row:
`| EXPO_PUBLIC_TRANSPORT_MODE | API transport: Rest, Grpc (Android native) or GrpcWeb; must match backend Transport:Mode | Rest |`
and row `| SENSWAVE_BACKEND_PROTO_DIR | Local backend proto dir for npm run proto:sync (dev tooling only) | — |`.

- [ ] **Step 7: Lint, typecheck, test, commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/api/transport/TransportMode.ts tests/api/transport/TransportMode.test.ts src/contexts/ConfigurationProvider.tsx env.d.ts .env.template AGENTS.md
git commit -m "feat: transport mode configuration with dev override

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 8: Open PR 1**

```bash
git push -u origin feat/transport-1-scaffolding
gh pr create --title "chore: proto sync, codegen and api scaffolding" --body "$(cat <<'EOF'
## Summary
- jest-expo test setup
- backend protos synced into `proto/`, connect-es code generated into `src/api/gen/`
- `TransportMode` (Rest | Grpc | GrpcWeb) from `EXPO_PUBLIC_TRANSPORT_MODE`, dev-only runtime override

Part 1 of the transport abstraction stack. Spec: `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md`.
No behaviour change for users.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR 2 — REST transport, interceptors, error model

Start: `git checkout -b feat/transport-2-rest-transport feat/transport-1-scaffolding`

### Task 4: Verify Connect API surface

**Files:** none (read-only)

**Interfaces:** confirms names used in Tasks 5–10.

- [ ] **Step 1: Confirm protocol exports**

Run:
```bash
grep -E "export \{|export declare function (runUnaryCall|runStreamingCall|normalize)" node_modules/@connectrpc/connect/dist/esm/protocol/index.d.ts node_modules/@connectrpc/connect/dist/esm/protocol/run-call.d.ts node_modules/@connectrpc/connect/dist/esm/protocol/normalize.d.ts
```
Expected: `runUnaryCall`, `runStreamingCall` exported from `@connectrpc/connect/protocol`; `normalize(desc, message)` present. Note the `runUnaryCall` option names: `req`, `next`, `timeout`, `signal`, `interceptors`.

- [ ] **Step 2: Confirm request/response shapes**

Run:
```bash
sed -n 1,200p node_modules/@connectrpc/connect/dist/esm/interceptor.d.ts
```
Expected: `UnaryRequest` has `stream: false, service, method, url, signal, header: Headers, contextValues, message, requestMethod`; `UnaryResponse` has `stream: false, service, method, header, message, trailer`. `Interceptor = (next: AnyFn) => AnyFn`.

If any name differs, adjust code in Tasks 5–10 to the installed typings and note it in the commit body. Do not pin older package versions to match the plan.

---

### Task 5: Error model

**Files:**
- Create: `src/api/errors.ts`
- Create: `tests/api/errors.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class ApiError extends Error {
      readonly code: Code; readonly httpStatus?: number; readonly errors: SenswaveError[]; readonly traceId?: string;
      constructor(args: { code: Code; message: string; httpStatus?: number; errors?: SenswaveError[]; traceId?: string; cause?: unknown });
      static is(e: unknown): e is ApiError;
      hasErrorCode(code: string): boolean;
      firstDescription(): string;
  }
  export type SenswaveError = Error (from common_pb) — re-exported as `SenswaveError`
  export const RestProblemDetailKey = "senswave.rest.problem";   // key in ConnectError metadata is not used; detail attached via `errorDetails`
  export function restProblemToErrors(json: unknown): { errors: SenswaveError[]; traceId?: string; message?: string };
  export function toApiError(reason: unknown, httpStatus?: number): ApiError;
  ```
  Transport-neutral: REST transport attaches parsed problem JSON to `ConnectError` through a `RestProblemDetail` proto-free detail (plain object on `ConnectError.cause`); `toApiError` reads it.

- [ ] **Step 1: Failing tests**

`tests/api/errors.test.ts`:
```ts
import { Code, ConnectError } from "@connectrpc/connect";
import { create, toBinary } from "@bufbuild/protobuf";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { ApiError, restProblemToErrors, toApiError, RestProblem } from "@/api/errors";

describe("restProblemToErrors", () => {
    it("parses Senswave ErrorProblemDetails", () => {
        const r = restProblemToErrors({
            statusCode: 404,
            title: "Not Found",
            type: "NotFound",
            errors: [{ code: "HomeNotFound", type: 3, description: "Home does not exist" }],
            traceId: "abc",
        });
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0].code).toBe("HomeNotFound");
        expect(r.errors[0].type).toBe(ErrorType.NOT_FOUND);
        expect(r.errors[0].description).toBe("Home does not exist");
        expect(r.traceId).toBe("abc");
        expect(r.message).toBe("Not Found");
    });

    it("parses Identity ValidationProblemDetails", () => {
        const r = restProblemToErrors({
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            title: "One or more validation errors occurred.",
            status: 400,
            errors: { PasswordTooShort: ["Passwords must be at least 6 characters."] },
        });
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0].code).toBe("PasswordTooShort");
        expect(r.errors[0].type).toBe(ErrorType.VALIDATION);
        expect(r.errors[0].description).toBe("Passwords must be at least 6 characters.");
    });

    it("prefers detail over title for message", () => {
        const r = restProblemToErrors({ title: "Unauthorized", detail: "NotAllowed", status: 401 });
        expect(r.message).toBe("NotAllowed");
        expect(r.errors).toHaveLength(0);
    });

    it("tolerates garbage", () => {
        expect(restProblemToErrors(null).errors).toEqual([]);
        expect(restProblemToErrors("text").errors).toEqual([]);
    });
});

describe("toApiError", () => {
    it("passes ApiError through", () => {
        const e = new ApiError({ code: Code.NotFound, message: "x" });
        expect(toApiError(e)).toBe(e);
    });

    it("reads senswave-errors-bin trailers from ConnectError", () => {
        const bin = toBinary(
            ErrorSchema,
            create(ErrorSchema, { code: "Conflict", type: ErrorType.CONFLICT, description: "dup" }),
        );
        const b64 = Buffer.from(bin).toString("base64");
        const md = new Headers();
        md.append("senswave-errors-bin", b64);
        md.append("senswave-trace-id", "trace-1");
        const ce = new ConnectError("already exists", Code.AlreadyExists, md);
        const e = toApiError(ce);
        expect(e.code).toBe(Code.AlreadyExists);
        expect(e.message).toBe("already exists");
        expect(e.errors[0].code).toBe("Conflict");
        expect(e.traceId).toBe("trace-1");
    });

    it("reads RestProblem cause", () => {
        const problem: RestProblem = {
            httpStatus: 403,
            body: { statusCode: 403, title: "Forbidden", type: "Legal", errors: [], traceId: "t" },
        };
        const ce = new ConnectError("Forbidden", Code.PermissionDenied, undefined, undefined, problem);
        const e = toApiError(ce);
        expect(e.httpStatus).toBe(403);
        expect(e.traceId).toBe("t");
        expect(e.code).toBe(Code.PermissionDenied);
    });

    it("wraps unknown as Unknown", () => {
        const e = toApiError(new Error("boom"));
        expect(e.code).toBe(Code.Unknown);
        expect(e.message).toBe("boom");
    });

    it("hasErrorCode and firstDescription", () => {
        const e = new ApiError({
            code: Code.InvalidArgument,
            message: "bad",
            errors: [create(ErrorSchema, { code: "X", description: "desc" })],
        });
        expect(e.hasErrorCode("X")).toBe(true);
        expect(e.firstDescription()).toBe("desc");
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/errors.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/api/errors.ts`:
```ts
import { Code, ConnectError } from "@connectrpc/connect";
import { create, fromBinary } from "@bufbuild/protobuf";
import { Error as SenswaveError, ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";

export type { SenswaveError };

export const ErrorsTrailerKey = "senswave-errors-bin";
export const TraceIdTrailerKey = "senswave-trace-id";

/** Attached as `cause` of a ConnectError by the REST transport. */
export interface RestProblem {
    httpStatus: number;
    body: unknown;
}

export const isRestProblem = (v: unknown): v is RestProblem =>
    typeof v === "object" && v !== null && "httpStatus" in v && "body" in v;

export class ApiError extends Error {
    readonly code: Code;
    readonly httpStatus?: number;
    readonly errors: SenswaveError[];
    readonly traceId?: string;

    constructor(args: {
        code: Code;
        message: string;
        httpStatus?: number;
        errors?: SenswaveError[];
        traceId?: string;
        cause?: unknown;
    }) {
        super(args.message, { cause: args.cause });
        this.name = "ApiError";
        this.code = args.code;
        this.httpStatus = args.httpStatus;
        this.errors = args.errors ?? [];
        this.traceId = args.traceId;
    }

    static is(e: unknown): e is ApiError {
        return e instanceof ApiError;
    }

    hasErrorCode(code: string): boolean {
        return this.errors.some((e) => e.code === code);
    }

    firstDescription(): string {
        const first = this.errors[0];
        if (!first) return this.message;
        return first.description || first.code;
    }
}

const errorTypeFromNumber = (n: unknown): ErrorType => {
    if (typeof n === "number" && n >= 0 && n <= 5) return n as ErrorType;
    return ErrorType.UNSPECIFIED;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Accepts both Senswave `ErrorProblemDetails` (errors: Error[]) and ASP.NET Identity
 * `ValidationProblemDetails` (errors: { [code]: string[] }).
 */
export const restProblemToErrors = (
    json: unknown,
): { errors: SenswaveError[]; traceId?: string; message?: string } => {
    const body = asRecord(json);
    if (!body) return { errors: [] };

    const errors: SenswaveError[] = [];
    const raw = body.errors;

    if (Array.isArray(raw)) {
        for (const item of raw) {
            const r = asRecord(item);
            if (!r) continue;
            errors.push(
                create(ErrorSchema, {
                    code: typeof r.code === "string" ? r.code : "",
                    type: errorTypeFromNumber(r.type),
                    description: typeof r.description === "string" ? r.description : "",
                }),
            );
        }
    } else {
        const map = asRecord(raw);
        if (map) {
            for (const [code, messages] of Object.entries(map)) {
                const description = Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : "";
                errors.push(create(ErrorSchema, { code, type: ErrorType.VALIDATION, description }));
            }
        }
    }

    const traceId = typeof body.traceId === "string" ? body.traceId : undefined;
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    const title = typeof body.title === "string" ? body.title : undefined;

    return { errors, traceId, message: detail ?? title };
};

const base64ToBytes = (b64: string): Uint8Array => {
    // atob exists in Hermes and Node ≥ 16
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
};

const errorsFromTrailers = (metadata: Headers): { errors: SenswaveError[]; traceId?: string } => {
    const errors: SenswaveError[] = [];
    // Headers joins repeated values with ", " — split them back.
    const joined = metadata.get(ErrorsTrailerKey);
    if (joined) {
        for (const part of joined.split(",")) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            try {
                errors.push(fromBinary(ErrorSchema, base64ToBytes(trimmed)));
            } catch (e) {
                console.warn("[ApiError] Failed to decode senswave-errors-bin entry", e);
            }
        }
    }
    return { errors, traceId: metadata.get(TraceIdTrailerKey) ?? undefined };
};

export const toApiError = (reason: unknown): ApiError => {
    if (ApiError.is(reason)) return reason;

    const ce = ConnectError.from(reason);

    if (isRestProblem(ce.cause)) {
        const parsed = restProblemToErrors(ce.cause.body);
        return new ApiError({
            code: ce.code,
            message: parsed.message ?? ce.rawMessage,
            httpStatus: ce.cause.httpStatus,
            errors: parsed.errors,
            traceId: parsed.traceId,
            cause: ce,
        });
    }

    const fromTrailers = errorsFromTrailers(ce.metadata);
    return new ApiError({
        code: ce.code,
        message: ce.rawMessage,
        errors: fromTrailers.errors,
        traceId: fromTrailers.traceId,
        cause: ce,
    });
};
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/api/errors.test.ts`
Expected: all pass. If `atob` is undefined in Jest, add to `jest.config.js`: `setupFiles: ["<rootDir>/tests/setup.ts"]` with `tests/setup.ts` containing
```ts
if (typeof globalThis.atob === "undefined") {
    globalThis.atob = (s: string) => Buffer.from(s, "base64").toString("binary");
}
```

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/api/errors.ts tests/api/errors.test.ts jest.config.js tests/setup.ts
git commit -m "feat: unified ApiError model for rest and grpc failures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: REST route table types and HTTP status mapping

**Files:**
- Create: `src/api/transport/rest/RestRoute.ts`
- Create: `src/api/transport/rest/httpStatusToCode.ts`
- Create: `tests/api/transport/rest/httpStatusToCode.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  export interface RestRoute<I extends DescMessage, O extends DescMessage> {
      method: HttpMethod;
      path: (req: MessageShape<I>) => string;            // relative to /api/, no leading slash
      body?: (req: MessageShape<I>) => unknown;          // JSON-serialisable
      response: (json: unknown, status: number) => MessageInitShape<O>;
  }
  export type RestRouteTable<S extends DescService> = { [K in keyof S["method"]]: RestRoute<S["method"][K]["input"], S["method"][K]["output"]> };
  export function defineRoutes<S extends DescService>(service: S, routes: RestRouteTable<S>): RestRouteRegistryEntry[];
  export interface RestRouteRegistryEntry { key: string; route: RestRoute<DescMessage, DescMessage> }  // key = "<service typeName>/<MethodName>"
  export function routeKey(method: DescMethod): string;
  export function httpStatusToCode(status: number): Code;
  ```

- [ ] **Step 1: Failing test for status mapping**

`tests/api/transport/rest/httpStatusToCode.test.ts`:
```ts
import { Code } from "@connectrpc/connect";
import { httpStatusToCode } from "@/api/transport/rest/httpStatusToCode";

describe("httpStatusToCode", () => {
    it.each([
        [400, Code.InvalidArgument],
        [401, Code.Unauthenticated],
        [403, Code.PermissionDenied],
        [404, Code.NotFound],
        [408, Code.DeadlineExceeded],
        [409, Code.AlreadyExists],
        [422, Code.InvalidArgument],
        [429, Code.ResourceExhausted],
        [500, Code.Internal],
        [501, Code.Unimplemented],
        [503, Code.Unavailable],
        [504, Code.DeadlineExceeded],
        [418, Code.Unknown],
    ])("%i → %s", (status, code) => {
        expect(httpStatusToCode(status)).toBe(code);
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/transport/rest/httpStatusToCode.test.ts`

- [ ] **Step 3: Implement**

`src/api/transport/rest/httpStatusToCode.ts`:
```ts
import { Code } from "@connectrpc/connect";

export const httpStatusToCode = (status: number): Code => {
    switch (status) {
        case 400:
        case 422:
            return Code.InvalidArgument;
        case 401:
            return Code.Unauthenticated;
        case 403:
            return Code.PermissionDenied;
        case 404:
            return Code.NotFound;
        case 408:
        case 504:
            return Code.DeadlineExceeded;
        case 409:
            return Code.AlreadyExists;
        case 429:
            return Code.ResourceExhausted;
        case 501:
            return Code.Unimplemented;
        case 503:
            return Code.Unavailable;
        default:
            return status >= 500 ? Code.Internal : Code.Unknown;
    }
};
```

`src/api/transport/rest/RestRoute.ts`:
```ts
import type { DescMessage, DescMethod, DescService, MessageInitShape, MessageShape } from "@bufbuild/protobuf";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RestRoute<I extends DescMessage, O extends DescMessage> {
    method: HttpMethod;
    /** Path relative to `/api/`, without leading slash. Query string included when needed. */
    path: (req: MessageShape<I>) => string;
    /** JSON body. Omit for GET / DELETE or when the endpoint takes no body. */
    body?: (req: MessageShape<I>) => unknown;
    /** Converts the parsed JSON body (undefined when empty) into the response message. */
    response: (json: unknown, status: number) => MessageInitShape<O>;
}

export type RestRouteTable<S extends DescService> = {
    [K in keyof S["method"]]: RestRoute<S["method"][K]["input"], S["method"][K]["output"]>;
};

export interface RestRouteRegistryEntry {
    key: string;
    route: RestRoute<DescMessage, DescMessage>;
}

export const routeKey = (method: DescMethod): string => `${method.parent.typeName}/${method.name}`;

/** Binds a route table to its service so every RPC must have a row (TypeScript enforces completeness). */
export const defineRoutes = <S extends DescService>(
    service: S,
    routes: RestRouteTable<S>,
): RestRouteRegistryEntry[] =>
    service.methods.map((m) => ({
        key: routeKey(m),
        route: routes[m.localName as keyof S["method"]] as RestRoute<DescMessage, DescMessage>,
    }));
```

- [ ] **Step 4: Run, typecheck, lint, commit**

```bash
npm test -- tests/api/transport/rest && npm run lint && npm run typecheck
git add src/api/transport/rest/RestRoute.ts src/api/transport/rest/httpStatusToCode.ts tests/api/transport/rest/httpStatusToCode.test.ts
git commit -m "feat: rest route table types and http status mapping

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: createRestTransport

**Files:**
- Create: `src/api/transport/rest/createRestTransport.ts`
- Create: `tests/api/transport/rest/createRestTransport.test.ts`

**Interfaces:**
- Consumes: `RestRouteRegistryEntry`, `routeKey`, `httpStatusToCode`, `RestProblem`.
- Produces:
  ```ts
  export interface RestTransportOptions {
      baseUrl: string;                       // e.g. "https://host:7070" — "/api/" appended
      routes: RestRouteRegistryEntry[];
      fetch?: typeof globalThis.fetch;
      interceptors?: Interceptor[];
      defaultTimeoutMs?: number;             // default 15000
  }
  export function createRestTransport(options: RestTransportOptions): Transport;
  ```
  Behaviour: `unary` looks up the route, runs interceptors via `runUnaryCall`, sends fetch, maps non-2xx to `ConnectError(code, cause: RestProblem)`, network failure → `Code.Unavailable`, abort → `Code.DeadlineExceeded` / `Code.Canceled`. `stream` rejects with `Code.Unimplemented`.

- [ ] **Step 1: Failing tests**

`tests/api/transport/rest/createRestTransport.test.ts`:
```ts
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { UsersService, GetUserRequestSchema } from "@/api/gen/users/v1/users_pb";
import { createRestTransport } from "@/api/transport/rest/createRestTransport";
import { defineRoutes } from "@/api/transport/rest/RestRoute";
import { isRestProblem } from "@/api/errors";

const jsonResponse = (status: number, body: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
    });

const routes = defineRoutes(UsersService, {
    getUser: {
        method: "GET",
        path: () => "v1/users",
        response: (json) => {
            const j = json as { id: string; email: string; theme: string; language: string; hasActiveConsent: boolean };
            return { id: j.id, email: j.email, theme: j.theme, language: j.language, hasActiveConsent: j.hasActiveConsent };
        },
    },
    updateSettings: {
        method: "PATCH",
        path: () => "v1/users/settings",
        body: (req) => ({ theme: req.theme || undefined, language: req.language || undefined }),
        response: () => ({}),
    },
    createConsents: { method: "POST", path: () => "v1/users/consents", body: () => ({}), response: () => ({}) },
    deleteAccount: { method: "DELETE", path: () => "v1/users/account", response: () => ({}) },
});

describe("createRestTransport", () => {
    it("builds URL, method, headers and parses the response", async () => {
        const calls: { url: string; init: RequestInit }[] = [];
        const fetchMock: typeof fetch = async (url, init) => {
            calls.push({ url: String(url), init: init ?? {} });
            return jsonResponse(200, { id: "1", email: "a@b.c", theme: "dark", language: "pl", hasActiveConsent: true });
        };
        const transport = createRestTransport({ baseUrl: "https://host:7070/", routes, fetch: fetchMock });
        const client = createClient(UsersService, transport);

        const res = await client.getUser(create(GetUserRequestSchema, {}), { headers: { Authorization: "Bearer t" } });

        expect(res.email).toBe("a@b.c");
        expect(res.hasActiveConsent).toBe(true);
        expect(calls[0].url).toBe("https://host:7070/api/v1/users");
        expect(calls[0].init.method).toBe("GET");
        const headers = new Headers(calls[0].init.headers);
        expect(headers.get("Authorization")).toBe("Bearer t");
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(calls[0].init.body).toBeUndefined();
    });

    it("serialises body for PATCH", async () => {
        let body: string | undefined;
        const fetchMock: typeof fetch = async (_url, init) => {
            body = init?.body as string;
            return jsonResponse(204, undefined);
        };
        const client = createClient(UsersService, createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock }));
        await client.updateSettings({ theme: "light" });
        expect(JSON.parse(body!)).toEqual({ theme: "light" });
    });

    it("maps non-2xx to ConnectError with RestProblem cause", async () => {
        const problem = { statusCode: 404, title: "Not Found", type: "x", errors: [], traceId: "t1" };
        const fetchMock: typeof fetch = async () => jsonResponse(404, problem);
        const client = createClient(UsersService, createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock }));

        const err = await client.getUser({}).catch((e) => e);
        expect(err).toBeInstanceOf(ConnectError);
        expect((err as ConnectError).code).toBe(Code.NotFound);
        expect(isRestProblem((err as ConnectError).cause)).toBe(true);
        expect(((err as ConnectError).cause as { httpStatus: number }).httpStatus).toBe(404);
    });

    it("maps network failure to Unavailable", async () => {
        const fetchMock: typeof fetch = async () => {
            throw new TypeError("Network request failed");
        };
        const client = createClient(UsersService, createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock }));
        const err = await client.getUser({}).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unavailable);
    });

    it("applies deadline", async () => {
        const fetchMock: typeof fetch = (_url, init) =>
            new Promise((_, reject) => {
                init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            });
        const client = createClient(
            UsersService,
            createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock, defaultTimeoutMs: 20 }),
        );
        const err = await client.getUser({}).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.DeadlineExceeded);
    });

    it("runs interceptors", async () => {
        const seen: string[] = [];
        const fetchMock: typeof fetch = async (_u, init) => {
            seen.push(new Headers(init?.headers).get("x-test") ?? "");
            return jsonResponse(200, { id: "1", email: "e", theme: "", language: "", hasActiveConsent: false });
        };
        const transport = createRestTransport({
            baseUrl: "https://h",
            routes,
            fetch: fetchMock,
            interceptors: [
                (next) => async (req) => {
                    req.header.set("x-test", "yes");
                    return next(req);
                },
            ],
        });
        await createClient(UsersService, transport).getUser({});
        expect(seen).toEqual(["yes"]);
    });

    it("rejects streams as Unimplemented", async () => {
        const transport = createRestTransport({ baseUrl: "https://h", routes, fetch: async () => jsonResponse(200, {}) });
        const { LiveUpdatesService } = await import("@/api/gen/liveupdates/v1/liveupdates_pb");
        const client = createClient(LiveUpdatesService, transport);
        const err = await (async () => {
            for await (const _ of client.subscribe({ homeReferenceId: "h" })) {
                // no-op
            }
        })().catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unimplemented);
    });

    it("throws Unimplemented for an RPC without a route", async () => {
        const transport = createRestTransport({ baseUrl: "https://h", routes: [], fetch: async () => jsonResponse(200, {}) });
        const err = await createClient(UsersService, transport).getUser({}).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unimplemented);
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/transport/rest/createRestTransport.test.ts`

- [ ] **Step 3: Implement**

`src/api/transport/rest/createRestTransport.ts`:
```ts
import type { DescMessage, DescMethodStreaming, DescMethodUnary, MessageInitShape } from "@bufbuild/protobuf";
import { create } from "@bufbuild/protobuf";
import {
    Code,
    ConnectError,
    type ContextValues,
    type Interceptor,
    type StreamResponse,
    type Transport,
    type UnaryResponse,
} from "@connectrpc/connect";
import { createContextValues } from "@connectrpc/connect";
import { runUnaryCall } from "@connectrpc/connect/protocol";
import type { RestProblem } from "@/api/errors";
import { httpStatusToCode } from "./httpStatusToCode";
import { routeKey, type RestRoute, type RestRouteRegistryEntry } from "./RestRoute";

export interface RestTransportOptions {
    /** Origin of the backend, e.g. "https://host:7070". "/api/" is appended. */
    baseUrl: string;
    routes: RestRouteRegistryEntry[];
    fetch?: typeof globalThis.fetch;
    interceptors?: Interceptor[];
    defaultTimeoutMs?: number;
}

const ensureTrailingSlash = (s: string) => (s.endsWith("/") ? s : `${s}/`);

const parseJsonBody = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

export const createRestTransport = (options: RestTransportOptions): Transport => {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const apiBase = `${ensureTrailingSlash(options.baseUrl)}api/`;
    const defaultTimeoutMs = options.defaultTimeoutMs ?? 15000;
    const routes = new Map<string, RestRoute<DescMessage, DescMessage>>(
        options.routes.map((e) => [e.key, e.route]),
    );

    return {
        async unary<I extends DescMessage, O extends DescMessage>(
            method: DescMethodUnary<I, O>,
            signal: AbortSignal | undefined,
            timeoutMs: number | undefined,
            header: HeadersInit | undefined,
            message: MessageInitShape<I>,
            contextValues?: ContextValues,
        ): Promise<UnaryResponse<I, O>> {
            const key = routeKey(method);
            const route = routes.get(key) as RestRoute<I, O> | undefined;
            if (!route) {
                throw new ConnectError(`No REST route for ${key}`, Code.Unimplemented);
            }

            return runUnaryCall<I, O>({
                interceptors: options.interceptors ?? [],
                signal,
                timeout: timeoutMs ?? defaultTimeoutMs,
                req: {
                    stream: false,
                    service: method.parent,
                    method,
                    requestMethod: route.method,
                    url: apiBase,
                    header: new Headers(header),
                    contextValues: contextValues ?? createContextValues(),
                    message: create(method.input, message),
                },
                next: async (req) => {
                    const url = `${apiBase}${route.path(req.message)}`;
                    const headers = new Headers(req.header);
                    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
                    if (!headers.has("Accept")) headers.set("Accept", "application/json");

                    const bodyValue = route.body ? route.body(req.message) : undefined;
                    const init: RequestInit = {
                        method: route.method,
                        headers,
                        body: bodyValue === undefined ? undefined : JSON.stringify(bodyValue),
                        signal: req.signal,
                    };

                    let response: Response;
                    try {
                        response = await fetchFn(url, init);
                    } catch (e) {
                        if (req.signal.aborted) {
                            throw ConnectError.from(req.signal.reason ?? e, Code.Canceled);
                        }
                        throw new ConnectError(
                            e instanceof Error ? e.message : "Network request failed",
                            Code.Unavailable,
                            undefined,
                            undefined,
                            e,
                        );
                    }

                    const json = await parseJsonBody(response);

                    if (!response.ok) {
                        const problem: RestProblem = { httpStatus: response.status, body: json };
                        throw new ConnectError(
                            response.statusText || `HTTP ${response.status}`,
                            httpStatusToCode(response.status),
                            undefined,
                            undefined,
                            problem,
                        );
                    }

                    return {
                        stream: false,
                        service: method.parent,
                        method,
                        header: response.headers,
                        message: create(method.output, route.response(json, response.status)),
                        trailer: new Headers(),
                    };
                },
            });
        },

        async stream<I extends DescMessage, O extends DescMessage>(
            method: DescMethodStreaming<I, O>,
        ): Promise<StreamResponse<I, O>> {
            throw new ConnectError(
                `Streaming is not available over REST (${routeKey(method)})`,
                Code.Unimplemented,
            );
        },
    };
};
```

Notes for the implementer:
- `runUnaryCall` converts a deadline into an `AbortSignal` with a `ConnectError(DeadlineExceeded)` reason and rejects with that error when the signal fires. If the installed version requires `req.signal` to be set by the caller, create it with `createDeadlineSignal(timeout)` from `@connectrpc/connect/protocol` and pass `signal` to `runUnaryCall` as documented in Task 4.
- Do not call `fetch` anywhere else in `src/api/`.

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/api/transport/rest/createRestTransport.test.ts`
Expected: 8 passed. If `Response` / `Headers` are missing in the Jest environment, add `testEnvironment: "node"` to `jest.config.js` (jest-expo default is node for `.ts` tests; `Response` exists in Node ≥ 18).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/api/transport/rest/createRestTransport.ts tests/api/transport/rest/createRestTransport.test.ts
git commit -m "feat: rest transport for connect clients

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: REST routes for users, legal and auth

**Files:**
- Create: `src/api/transport/rest/converters.ts`
- Create: `src/api/transport/rest/routes/users.ts`, `legal.ts`, `auth.ts`, `index.ts`
- Create: `tests/api/transport/rest/routes/users.test.ts`, `legal.test.ts`, `auth.test.ts`

**Interfaces:**
- Consumes: `defineRoutes`, `RestRouteTable`, generated services `UsersService`, `LegalService`, `AuthService`, `TimestampSchema`.
- Produces:
  ```ts
  // converters.ts
  export function timestampFromIso(iso: unknown): MessageInitShape<typeof TimestampSchema> | undefined;
  export function str(v: unknown): string;          // "" when not a string
  export function bool(v: unknown): boolean;
  export const empty = () => ({});                   // response for 200/204 without body
  export function asRecord(v: unknown): Record<string, unknown>;
  // routes/index.ts
  export const restRoutes: RestRouteRegistryEntry[]; // all modules registered so far
  ```

Backend REST shapes (from `Senswave.Users.Api`):
- `GET v1/users` → `{ id: Guid, email, theme, language, hasActiveConsent }`
- `PATCH v1/users/settings` body `{ theme?, language? }` → 204
- `POST v1/users/consents` body `{}` → 204
- `DELETE v1/users/account` → 204
- `GET v1/legal/terms`, `GET v1/legal/privacy` → `{ id, version, content, summary, createdAtUtc: ISO }`
- Identity (`MapIdentityApi` on `api/v1/auth`): `POST login` `{ email, password, twoFactorCode?, twoFactorRecoveryCode? }` → `{ tokenType, accessToken, expiresIn, refreshToken }`; `POST refresh` `{ refreshToken }` → same; `POST register` `{ email, password }` → 200 empty; `POST confirmEmail?userId=&code=[&changedEmail=]` → 200 text; `POST resendConfirmationEmail` `{ email }` → 200; `POST forgotPassword` `{ email }` → 200; `POST resetPassword` `{ email, resetCode, newPassword }` → 200.

- [ ] **Step 1: Failing tests**

`tests/api/transport/rest/routes/users.test.ts`:
```ts
import { create } from "@bufbuild/protobuf";
import { UsersService, UpdateSettingsRequestSchema } from "@/api/gen/users/v1/users_pb";
import { usersRoutes } from "@/api/transport/rest/routes/users";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof UsersService.method) =>
    usersRoutes.find((e) => e.key === routeKey(UsersService.method[name]))!.route;

describe("users REST routes", () => {
    it("covers every RPC", () => {
        expect(usersRoutes.map((e) => e.key).sort()).toEqual(
            UsersService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("getUser", () => {
        const r = route("getUser");
        expect(r.method).toBe("GET");
        expect(r.path({} as never)).toBe("v1/users");
        const out = r.response({ id: "u1", email: "a@b", theme: "dark", language: "en", hasActiveConsent: true }, 200);
        expect(out).toEqual({ id: "u1", email: "a@b", theme: "dark", language: "en", hasActiveConsent: true });
    });

    it("updateSettings sends only provided fields", () => {
        const r = route("updateSettings");
        expect(r.method).toBe("PATCH");
        expect(r.path({} as never)).toBe("v1/users/settings");
        expect(r.body!(create(UpdateSettingsRequestSchema, { theme: "light" }) as never)).toEqual({ theme: "light" });
        expect(r.body!(create(UpdateSettingsRequestSchema, { language: "pl" }) as never)).toEqual({ language: "pl" });
    });

    it("createConsents and deleteAccount", () => {
        expect(route("createConsents").method).toBe("POST");
        expect(route("createConsents").path({} as never)).toBe("v1/users/consents");
        expect(route("deleteAccount").method).toBe("DELETE");
        expect(route("deleteAccount").path({} as never)).toBe("v1/users/account");
        expect(route("deleteAccount").response(undefined, 204)).toEqual({});
    });
});
```

`tests/api/transport/rest/routes/legal.test.ts`:
```ts
import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { legalRoutes } from "@/api/transport/rest/routes/legal";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof LegalService.method) =>
    legalRoutes.find((e) => e.key === routeKey(LegalService.method[name]))!.route;

describe("legal REST routes", () => {
    it("covers every RPC", () => {
        expect(legalRoutes).toHaveLength(LegalService.methods.length);
    });

    it("maps terms with timestamp", () => {
        const r = route("getTermsAndConditions");
        expect(r.method).toBe("GET");
        expect(r.path({} as never)).toBe("v1/legal/terms");
        const out = r.response(
            { id: "1", version: "2", content: "c", summary: "s", createdAtUtc: "2026-01-02T03:04:05Z" },
            200,
        ) as { createdAtUtc?: { seconds: bigint } };
        expect(out.createdAtUtc?.seconds).toBe(BigInt(Date.UTC(2026, 0, 2, 3, 4, 5) / 1000));
    });

    it("privacy path", () => {
        expect(route("getPrivacyPolicy").path({} as never)).toBe("v1/legal/privacy");
    });
});
```

`tests/api/transport/rest/routes/auth.test.ts`:
```ts
import { create } from "@bufbuild/protobuf";
import {
    AuthService,
    ConfirmEmailRequestSchema,
    LoginRequestSchema,
    ResetPasswordRequestSchema,
} from "@/api/gen/users/v1/auth_pb";
import { authRoutes } from "@/api/transport/rest/routes/auth";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof AuthService.method) =>
    authRoutes.find((e) => e.key === routeKey(AuthService.method[name]))!.route;

describe("auth REST routes", () => {
    it("covers every RPC", () => {
        expect(authRoutes).toHaveLength(AuthService.methods.length);
    });

    it("login", () => {
        const r = route("login");
        const req = create(LoginRequestSchema, { email: "a@b", password: "p" });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/auth/login");
        expect(r.body!(req as never)).toEqual({ email: "a@b", password: "p" });
        expect(
            r.response({ tokenType: "Bearer", accessToken: "a", expiresIn: 3600, refreshToken: "r" }, 200),
        ).toEqual({ tokenType: "Bearer", accessToken: "a", expiresIn: BigInt(3600), refreshToken: "r" });
    });

    it("confirmEmail uses query string", () => {
        const r = route("confirmEmail");
        const req = create(ConfirmEmailRequestSchema, { userId: "u 1", code: "c&d" });
        expect(r.path(req as never)).toBe("v1/auth/confirmEmail?userId=u%201&code=c%26d");
        expect(r.body).toBeUndefined();
        const withEmail = create(ConfirmEmailRequestSchema, { userId: "u", code: "c", changedEmail: "x@y" });
        expect(r.path(withEmail as never)).toBe("v1/auth/confirmEmail?userId=u&code=c&changedEmail=x%40y");
    });

    it("resetPassword body", () => {
        const r = route("resetPassword");
        const req = create(ResetPasswordRequestSchema, { email: "e", resetCode: "rc", newPassword: "np" });
        expect(r.body!(req as never)).toEqual({ email: "e", resetCode: "rc", newPassword: "np" });
    });

    it("refresh, register, forgot, resend", () => {
        expect(route("refresh").path({} as never)).toBe("v1/auth/refresh");
        expect(route("register").path({} as never)).toBe("v1/auth/register");
        expect(route("forgotPassword").path({} as never)).toBe("v1/auth/forgotPassword");
        expect(route("resendConfirmationEmail").path({} as never)).toBe("v1/auth/resendConfirmationEmail");
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/transport/rest/routes`

- [ ] **Step 3: Implement converters**

`src/api/transport/rest/converters.ts`:
```ts
import type { MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate, type TimestampSchema } from "@bufbuild/protobuf/wkt";

export const asRecord = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const str = (v: unknown): string => (typeof v === "string" ? v : "");

export const bool = (v: unknown): boolean => v === true;

export const num = (v: unknown): number => (typeof v === "number" ? v : 0);

export const empty = (): Record<string, never> => ({});

export const timestampFromIso = (
    iso: unknown,
): MessageInitShape<typeof TimestampSchema> | undefined => {
    if (typeof iso !== "string") return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return timestampFromDate(d);
};

/** Builds "?a=1&b=2" from defined values only; returns "" when nothing is defined. */
export const query = (params: Record<string, string | number | undefined>): string => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") p.append(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : "";
};
```

- [ ] **Step 4: Implement route files**

`src/api/transport/rest/routes/users.ts`:
```ts
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, bool, empty, str } from "../converters";

export const usersRoutes = defineRoutes(UsersService, {
    getUser: {
        method: "GET",
        path: () => "v1/users",
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                email: str(j.email),
                theme: str(j.theme),
                language: str(j.language),
                hasActiveConsent: bool(j.hasActiveConsent),
            };
        },
    },
    updateSettings: {
        method: "PATCH",
        path: () => "v1/users/settings",
        body: (req) => ({
            theme: req.theme || undefined,
            language: req.language || undefined,
        }),
        response: empty,
    },
    createConsents: {
        method: "POST",
        path: () => "v1/users/consents",
        body: () => ({}),
        response: empty,
    },
    deleteAccount: {
        method: "DELETE",
        path: () => "v1/users/account",
        response: empty,
    },
});
```

`src/api/transport/rest/routes/legal.ts`:
```ts
import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, str, timestampFromIso } from "../converters";

const legalDocument = (json: unknown) => {
    const j = asRecord(json);
    return {
        id: str(j.id),
        version: str(j.version),
        summary: str(j.summary),
        content: str(j.content),
        createdAtUtc: timestampFromIso(j.createdAtUtc),
    };
};

export const legalRoutes = defineRoutes(LegalService, {
    getTermsAndConditions: { method: "GET", path: () => "v1/legal/terms", response: legalDocument },
    getPrivacyPolicy: { method: "GET", path: () => "v1/legal/privacy", response: legalDocument },
});
```

`src/api/transport/rest/routes/auth.ts`:
```ts
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, num, query, str } from "../converters";

const accessToken = (json: unknown) => {
    const j = asRecord(json);
    return {
        tokenType: str(j.tokenType),
        accessToken: str(j.accessToken),
        expiresIn: BigInt(num(j.expiresIn)),
        refreshToken: str(j.refreshToken),
    };
};

export const authRoutes = defineRoutes(AuthService, {
    register: {
        method: "POST",
        path: () => "v1/auth/register",
        body: (req) => ({ email: req.email, password: req.password }),
        response: empty,
    },
    login: {
        method: "POST",
        path: () => "v1/auth/login",
        body: (req) => ({
            email: req.email,
            password: req.password,
            twoFactorCode: req.twoFactorCode,
            twoFactorRecoveryCode: req.twoFactorRecoveryCode,
        }),
        response: accessToken,
    },
    refresh: {
        method: "POST",
        path: () => "v1/auth/refresh",
        body: (req) => ({ refreshToken: req.refreshToken }),
        response: accessToken,
    },
    confirmEmail: {
        method: "POST",
        path: (req) =>
            `v1/auth/confirmEmail${query({
                userId: req.userId,
                code: req.code,
                changedEmail: req.changedEmail,
            })}`,
        response: empty,
    },
    resendConfirmationEmail: {
        method: "POST",
        path: () => "v1/auth/resendConfirmationEmail",
        body: (req) => ({ email: req.email }),
        response: empty,
    },
    forgotPassword: {
        method: "POST",
        path: () => "v1/auth/forgotPassword",
        body: (req) => ({ email: req.email }),
        response: empty,
    },
    resetPassword: {
        method: "POST",
        path: () => "v1/auth/resetPassword",
        body: (req) => ({ email: req.email, resetCode: req.resetCode, newPassword: req.newPassword }),
        response: empty,
    },
});
```

`src/api/transport/rest/routes/index.ts`:
```ts
import type { RestRouteRegistryEntry } from "../RestRoute";
import { authRoutes } from "./auth";
import { legalRoutes } from "./legal";
import { usersRoutes } from "./users";

// Later PRs append homes, rooms, sharing, devices, dashboards, operations, widgets, automations, dataSources, account.
export const restRoutes: RestRouteRegistryEntry[] = [...usersRoutes, ...legalRoutes, ...authRoutes];
```

Note: `login.body` emits `twoFactorCode: undefined` when unset; `JSON.stringify` drops undefined keys, so the wire body matches the test `{ email, password }`. The test uses `toEqual`, which ignores undefined properties.

- [ ] **Step 5: Run, expect pass**

Run: `npm test -- tests/api/transport/rest/routes`
Expected: all pass. If `@bufbuild/protobuf/wkt` does not export `timestampFromDate`, use `create(TimestampSchema, { seconds: BigInt(Math.floor(ms / 1000)), nanos: (ms % 1000) * 1e6 })` with `TimestampSchema` imported from `@/api/gen/google/protobuf/timestamp_pb`.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/api/transport/rest/converters.ts src/api/transport/rest/routes tests/api/transport/rest/routes
git commit -m "feat: rest routes for users, legal and auth services

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Interceptors (auth, legal, errors)

**Files:**
- Create: `src/api/interceptors/authInterceptor.ts`
- Create: `src/api/interceptors/legalInterceptor.ts`
- Create: `src/api/interceptors/errorInterceptor.ts`
- Create: `src/api/interceptors/index.ts`
- Create: `tests/api/interceptors/authInterceptor.test.ts`, `legalInterceptor.test.ts`, `errorInterceptor.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AuthInterceptorDeps {
      getAccessToken: () => string | null;          // null when not authenticated
      refresh: () => Promise<string | null>;        // SessionProvider.refresh
      logout: () => void;
      onRefreshFailed: () => void;                   // counter + toast handled by ApiProvider
  }
  export const AnonymousServices: ReadonlySet<string>;  // typeNames of AuthService, LegalService
  export function createAuthInterceptor(deps: AuthInterceptorDeps): Interceptor;
  export interface LegalInterceptorDeps { logout: () => void; onForbidden: (error: ConnectError) => void }
  export function createLegalInterceptor(deps: LegalInterceptorDeps): Interceptor;
  export function createErrorInterceptor(): Interceptor;   // rethrows everything as ApiError
  export function createInterceptors(deps: AuthInterceptorDeps & LegalInterceptorDeps): Interceptor[]; // [auth, legal, errors]
  ```
  Order is outer→inner: auth wraps legal wraps errors. Errors interceptor is innermost so auth/legal see `ConnectError` codes; callers see `ApiError`.

- [ ] **Step 1: Failing tests**

`tests/api/interceptors/authInterceptor.test.ts`:
```ts
import { Code, ConnectError, type UnaryRequest, type UnaryResponse } from "@connectrpc/connect";
import { createContextValues } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { createAuthInterceptor } from "@/api/interceptors/authInterceptor";

const unaryReq = (service = UsersService, method = UsersService.method.getUser): UnaryRequest =>
    ({
        stream: false,
        service,
        method,
        url: "https://h/api/",
        signal: new AbortController().signal,
        header: new Headers(),
        contextValues: createContextValues(),
        message: {},
        requestMethod: "GET",
    }) as unknown as UnaryRequest;

const okRes = (): UnaryResponse =>
    ({ stream: false, service: UsersService, method: UsersService.method.getUser, header: new Headers(), message: {}, trailer: new Headers() }) as unknown as UnaryResponse;

describe("authInterceptor", () => {
    it("adds bearer header", async () => {
        let seen: string | null = null;
        const i = createAuthInterceptor({
            getAccessToken: () => "tok",
            refresh: async () => null,
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        await i(async (req) => {
            seen = req.header.get("Authorization");
            return okRes();
        })(unaryReq());
        expect(seen).toBe("Bearer tok");
    });

    it("skips anonymous services", async () => {
        let seen: string | null = "x";
        const i = createAuthInterceptor({ getAccessToken: () => "tok", refresh: async () => null, logout: jest.fn(), onRefreshFailed: jest.fn() });
        await i(async (req) => {
            seen = req.header.get("Authorization");
            return okRes();
        })(unaryReq(AuthService, AuthService.method.login));
        expect(seen).toBeNull();
    });

    it("logs out and throws Unauthenticated when no token", async () => {
        const logout = jest.fn();
        const i = createAuthInterceptor({ getAccessToken: () => null, refresh: async () => null, logout, onRefreshFailed: jest.fn() });
        const err = await i(async () => okRes())(unaryReq()).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unauthenticated);
        expect(logout).toHaveBeenCalled();
    });

    it("refreshes once and retries with new token", async () => {
        const tokens: string[] = [];
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => "new",
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const res = await i(async (req) => {
            const t = req.header.get("Authorization")!;
            tokens.push(t);
            if (t === "Bearer old") throw new ConnectError("401", Code.Unauthenticated);
            return okRes();
        })(unaryReq());
        expect(res).toBeTruthy();
        expect(tokens).toEqual(["Bearer old", "Bearer new"]);
    });

    it("does not retry twice", async () => {
        let calls = 0;
        const i = createAuthInterceptor({ getAccessToken: () => "old", refresh: async () => "new", logout: jest.fn(), onRefreshFailed: jest.fn() });
        const err = await i(async () => {
            calls++;
            throw new ConnectError("401", Code.Unauthenticated);
        })(unaryReq()).catch((e) => e);
        expect(calls).toBe(2);
        expect((err as ConnectError).code).toBe(Code.Unauthenticated);
    });

    it("reports failed refresh and rethrows", async () => {
        const onRefreshFailed = jest.fn();
        const i = createAuthInterceptor({ getAccessToken: () => "old", refresh: async () => null, logout: jest.fn(), onRefreshFailed });
        const err = await i(async () => {
            throw new ConnectError("401", Code.Unauthenticated);
        })(unaryReq()).catch((e) => e);
        expect(onRefreshFailed).toHaveBeenCalledTimes(1);
        expect((err as ConnectError).code).toBe(Code.Unauthenticated);
    });

    it("dedupes concurrent refreshes", async () => {
        let refreshCalls = 0;
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => {
                refreshCalls++;
                await new Promise((r) => setTimeout(r, 5));
                return "new";
            },
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const next = async (req: UnaryRequest) => {
            if (req.header.get("Authorization") === "Bearer old") throw new ConnectError("401", Code.Unauthenticated);
            return okRes();
        };
        await Promise.all([i(next as never)(unaryReq()), i(next as never)(unaryReq()), i(next as never)(unaryReq())]);
        expect(refreshCalls).toBe(1);
    });

    it("does not retry streams", async () => {
        let calls = 0;
        const i = createAuthInterceptor({ getAccessToken: () => "old", refresh: async () => "new", logout: jest.fn(), onRefreshFailed: jest.fn() });
        const streamReq = { ...unaryReq(), stream: true } as never;
        await i(async () => {
            calls++;
            throw new ConnectError("401", Code.Unauthenticated);
        })(streamReq).catch(() => undefined);
        expect(calls).toBe(1);
    });
});
```

`tests/api/interceptors/legalInterceptor.test.ts`:
```ts
import { Code, ConnectError, createContextValues, type UnaryRequest } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { createLegalInterceptor } from "@/api/interceptors/legalInterceptor";

const req = () =>
    ({
        stream: false,
        service: UsersService,
        method: UsersService.method.getUser,
        url: "",
        signal: new AbortController().signal,
        header: new Headers(),
        contextValues: createContextValues(),
        message: {},
        requestMethod: "GET",
    }) as unknown as UnaryRequest;

describe("legalInterceptor", () => {
    it("logs out on PermissionDenied and rethrows", async () => {
        const logout = jest.fn();
        const onForbidden = jest.fn();
        const i = createLegalInterceptor({ logout, onForbidden });
        const err = await i(async () => {
            throw new ConnectError("forbidden", Code.PermissionDenied);
        })(req()).catch((e) => e);
        expect(logout).toHaveBeenCalled();
        expect(onForbidden).toHaveBeenCalledWith(expect.any(ConnectError));
        expect((err as ConnectError).code).toBe(Code.PermissionDenied);
    });

    it("ignores other codes", async () => {
        const logout = jest.fn();
        const i = createLegalInterceptor({ logout, onForbidden: jest.fn() });
        await i(async () => {
            throw new ConnectError("nf", Code.NotFound);
        })(req()).catch(() => undefined);
        expect(logout).not.toHaveBeenCalled();
    });
});
```

`tests/api/interceptors/errorInterceptor.test.ts`:
```ts
import { Code, ConnectError, createContextValues, type UnaryRequest } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { createErrorInterceptor } from "@/api/interceptors/errorInterceptor";
import { ApiError } from "@/api/errors";

const req = () =>
    ({
        stream: false,
        service: UsersService,
        method: UsersService.method.getUser,
        url: "",
        signal: new AbortController().signal,
        header: new Headers(),
        contextValues: createContextValues(),
        message: {},
        requestMethod: "GET",
    }) as unknown as UnaryRequest;

describe("errorInterceptor", () => {
    it("converts ConnectError into ApiError", async () => {
        const i = createErrorInterceptor();
        const err = await i(async () => {
            throw new ConnectError("nf", Code.NotFound);
        })(req()).catch((e) => e);
        expect(ApiError.is(err)).toBe(true);
        expect((err as ApiError).code).toBe(Code.NotFound);
    });

    it("converts unknown errors", async () => {
        const i = createErrorInterceptor();
        const err = await i(async () => {
            throw new Error("x");
        })(req()).catch((e) => e);
        expect(ApiError.is(err)).toBe(true);
        expect((err as ApiError).code).toBe(Code.Unknown);
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/interceptors`

- [ ] **Step 3: Implement**

`src/api/interceptors/authInterceptor.ts`:
```ts
import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { LegalService } from "@/api/gen/users/v1/legal_pb";

export interface AuthInterceptorDeps {
    /** Current access token, or null when there is no authenticated session. */
    getAccessToken: () => string | null;
    /** Refreshes the session; resolves with the new access token or null when refresh failed. */
    refresh: () => Promise<string | null>;
    logout: () => void;
    /** Called once per failed refresh so the provider can count failures and toast. */
    onRefreshFailed: () => void;
}

export const AnonymousServices: ReadonlySet<string> = new Set([
    AuthService.typeName,
    LegalService.typeName,
]);

const isUnauthenticated = (e: unknown) => ConnectError.from(e).code === Code.Unauthenticated;

export const createAuthInterceptor = (deps: AuthInterceptorDeps): Interceptor => {
    // One in-flight refresh shared by every concurrent caller.
    let inflightRefresh: Promise<string | null> | null = null;

    const refreshOnce = (): Promise<string | null> => {
        if (!inflightRefresh) {
            inflightRefresh = deps
                .refresh()
                .catch(() => null)
                .finally(() => {
                    inflightRefresh = null;
                });
        }
        return inflightRefresh;
    };

    return (next) => async (req) => {
        if (AnonymousServices.has(req.service.typeName)) {
            return next(req);
        }

        const token = deps.getAccessToken();
        if (!token) {
            deps.logout();
            console.error("[Api] User is not authenticated.");
            throw new ConnectError("Not authenticated", Code.Unauthenticated);
        }

        req.header.set("Authorization", `Bearer ${token}`);

        try {
            return await next(req);
        } catch (e) {
            if (!isUnauthenticated(e) || req.stream) throw e;

            const newToken = await refreshOnce();
            if (!newToken) {
                console.error("[Api] Failed to refresh auth token");
                deps.onRefreshFailed();
                throw e;
            }

            req.header.set("Authorization", `Bearer ${newToken}`);
            return next(req);
        }
    };
};
```

`src/api/interceptors/legalInterceptor.ts`:
```ts
import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";

export interface LegalInterceptorDeps {
    logout: () => void;
    /** Receives the original error so the provider can toast its description. */
    onForbidden: (error: ConnectError) => void;
}

// PermissionDenied is only returned by LegalMiddleware / LegalConsentInterceptor
// when the user has not accepted the latest terms. Same rule as the old 403 handling.
export const createLegalInterceptor = (deps: LegalInterceptorDeps): Interceptor => (next) => async (req) => {
    try {
        return await next(req);
    } catch (e) {
        const ce = ConnectError.from(e);
        if (ce.code === Code.PermissionDenied) {
            deps.logout();
            console.warn("[Api] Logged out due to PermissionDenied (missing consents).");
            deps.onForbidden(ce);
        }
        throw e;
    }
};
```

`src/api/interceptors/errorInterceptor.ts`:
```ts
import type { Interceptor } from "@connectrpc/connect";
import { toApiError } from "@/api/errors";

/** Innermost interceptor: every failure leaving the chain is an ApiError. */
export const createErrorInterceptor = (): Interceptor => (next) => async (req) => {
    try {
        return await next(req);
    } catch (e) {
        throw toApiError(e);
    }
};
```

`src/api/interceptors/index.ts`:
```ts
import type { Interceptor } from "@connectrpc/connect";
import { createAuthInterceptor, type AuthInterceptorDeps } from "./authInterceptor";
import { createErrorInterceptor } from "./errorInterceptor";
import { createLegalInterceptor, type LegalInterceptorDeps } from "./legalInterceptor";

export type InterceptorDeps = AuthInterceptorDeps & LegalInterceptorDeps;

/** Outer → inner: auth, legal, errors. */
export const createInterceptors = (deps: InterceptorDeps): Interceptor[] => [
    createAuthInterceptor(deps),
    createLegalInterceptor(deps),
    createErrorInterceptor(),
];

export { createAuthInterceptor, createLegalInterceptor, createErrorInterceptor };
export type { AuthInterceptorDeps, LegalInterceptorDeps };
```

Note: because `errors` is innermost, `auth` and `legal` receive an `ApiError` (subclass of `Error`, not `ConnectError`). `ConnectError.from(apiError)` would yield `Code.Unknown`. Fix: in `toApiError`, the returned `ApiError` keeps `code`; make `isUnauthenticated` and the legal check read `ApiError.code` first:

In `authInterceptor.ts` replace `isUnauthenticated` with:
```ts
import { ApiError } from "@/api/errors";
const codeOf = (e: unknown): Code => (ApiError.is(e) ? e.code : ConnectError.from(e).code);
const isUnauthenticated = (e: unknown) => codeOf(e) === Code.Unauthenticated;
```
In `legalInterceptor.ts` replace the catch body's first two lines with:
```ts
        const code = ApiError.is(e) ? e.code : ConnectError.from(e).code;
        if (code === Code.PermissionDenied) {
            deps.logout();
            console.warn("[Api] Logged out due to PermissionDenied (missing consents).");
            deps.onForbidden(ApiError.is(e) ? e : ConnectError.from(e));
        }
```
and widen `onForbidden: (error: ApiError | ConnectError) => void`. Update the legal test's `expect(onForbidden).toHaveBeenCalledWith(expect.any(ConnectError))` to `expect.anything()`.

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/api/interceptors`
Expected: all pass.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/api/interceptors tests/api/interceptors
git commit -m "feat: auth, legal and error interceptors for api clients

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: createTransport, clients, call helper

**Files:**
- Create: `src/api/transport/createTransport.ts`
- Create: `src/api/clients.ts`
- Create: `src/api/call.ts`
- Create: `tests/api/clients.test.ts`, `tests/api/call.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CreateTransportOptions { mode: TransportMode; baseUrl: string; interceptors: Interceptor[]; fetch?: typeof fetch }
  export function createTransport(options: CreateTransportOptions): Transport;   // Rest only; Grpc/GrpcWeb throw Error("not implemented yet")
  export interface ApiClients {
      homes: Client<typeof HomesService>; rooms: Client<typeof RoomsService>; homeSharing: Client<typeof HomesSharingService>;
      devices: Client<typeof DevicesService>; dashboards: Client<typeof DashboardsService>; operations: Client<typeof OperationsService>;
      widgets: Client<typeof WidgetsService>; deviceSharing: Client<typeof DevicesSharingService>;
      automations: Client<typeof AutomationsService>; dataSources: Client<typeof DataSourcesService>;
      users: Client<typeof UsersService>; account: Client<typeof AccountService>; auth: Client<typeof AuthService>; legal: Client<typeof LegalService>;
      liveUpdates: Client<typeof LiveUpdatesService>;
  }
  export function createApiClients(transport: Transport): ApiClients;
  export function call<T>(fn: () => Promise<T>, failureMessage?: string): Promise<Result<T>>;
  export function callSimple(fn: () => Promise<unknown>, failureMessage?: string): Promise<SimpleResult>;
  ```
  `call` catches `ApiError`, returns `Result.failure(error.firstDescription() || failureMessage)`, and attaches the `ApiError` as `Result.error` — add an optional `error?: ApiError` field to `Result` and `SimpleResult` in `src/utils/result.tsx`.

- [ ] **Step 1: Failing tests**

`tests/api/clients.test.ts`:
```ts
import { createApiClients } from "@/api/clients";
import { createTransport } from "@/api/transport/createTransport";

describe("createApiClients", () => {
    it("exposes a client per service", () => {
        const transport = createTransport({ mode: "Rest", baseUrl: "https://h", interceptors: [] });
        const api = createApiClients(transport);
        expect(typeof api.homes.getHome).toBe("function");
        expect(typeof api.auth.login).toBe("function");
        expect(typeof api.liveUpdates.subscribe).toBe("function");
    });

    it("createTransport rejects unimplemented modes", () => {
        expect(() => createTransport({ mode: "Grpc", baseUrl: "https://h", interceptors: [] })).toThrow(/Grpc/);
        expect(() => createTransport({ mode: "GrpcWeb", baseUrl: "https://h", interceptors: [] })).toThrow(/GrpcWeb/);
    });
});
```

`tests/api/call.test.ts`:
```ts
import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ErrorSchema } from "@/api/gen/common/v1/common_pb";
import { ApiError } from "@/api/errors";
import { call, callSimple } from "@/api/call";

describe("call", () => {
    it("wraps success", async () => {
        const r = await call(async () => 5);
        expect(r.isSuccess).toBe(true);
        expect(r.data).toBe(5);
    });

    it("wraps ApiError using first description", async () => {
        const e = new ApiError({ code: Code.NotFound, message: "nf", errors: [create(ErrorSchema, { code: "X", description: "Missing" })] });
        const r = await call(async () => {
            throw e;
        }, "fallback");
        expect(r.isSuccess).toBe(false);
        expect(r.errorMessage).toBe("Missing");
        expect(r.error).toBe(e);
    });

    it("uses fallback when no description", async () => {
        const r = await callSimple(async () => {
            throw new ApiError({ code: Code.Internal, message: "" });
        }, "Failed to update theme.");
        expect(r.errorMessage).toBe("Failed to update theme.");
    });

    it("wraps non-ApiError", async () => {
        const r = await call(async () => {
            throw new Error("boom");
        });
        expect(r.isSuccess).toBe(false);
        expect(r.error?.code).toBe(Code.Unknown);
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/clients.test.ts tests/api/call.test.ts`

- [ ] **Step 3: Implement**

`src/utils/result.tsx` — add the optional error field to both classes:
```ts
import type { ApiError } from "@/api/errors";

export class SimpleResult {
    isSuccess: boolean;
    errorMessage: string | null;
    error?: ApiError;

    constructor(isSuccess: boolean, errorMessage: string | null = null, error?: ApiError) {
        this.isSuccess = isSuccess;
        this.errorMessage = errorMessage;
        this.error = error;
    }

    static success(): SimpleResult {
        return new SimpleResult(true, null);
    }

    static failure(errorMessage: string, error?: ApiError): SimpleResult {
        return new SimpleResult(false, errorMessage, error);
    }
}

export class Result<T = any> {
    data: T | null;
    isSuccess: boolean;
    errorMessage: string | null;
    error?: ApiError;

    constructor(isSuccess: boolean, data: T | null = null, errorMessage: string | null = null, error?: ApiError) {
        this.isSuccess = isSuccess;
        this.data = data;
        this.errorMessage = errorMessage;
        this.error = error;
    }

    static success<T>(data: T): Result<T> {
        return new Result<T>(true, data, null);
    }

    static failure<T>(errorMessage: string, error?: ApiError): Result<T> {
        return new Result<T>(false, null, errorMessage, error);
    }

    static failureWithData<T>(errorMessage: string, data: T, error?: ApiError): Result<T> {
        return new Result<T>(false, data, errorMessage, error);
    }
}
```

`src/api/call.ts`:
```ts
import { Result, SimpleResult } from "@/utils/result";
import { toApiError } from "./errors";

const messageOf = (e: unknown, fallback: string) => {
    const err = toApiError(e);
    const text = err.firstDescription();
    return { err, text: text && text.trim() ? text : fallback };
};

/** Runs an api client call and folds the outcome into Result<T>. Never throws. */
export const call = async <T>(fn: () => Promise<T>, fallback = "Request failed."): Promise<Result<T>> => {
    try {
        return Result.success<T>(await fn());
    } catch (e) {
        const { err, text } = messageOf(e, fallback);
        return Result.failure<T>(text, err);
    }
};

export const callSimple = async (fn: () => Promise<unknown>, fallback = "Request failed."): Promise<SimpleResult> => {
    try {
        await fn();
        return SimpleResult.success();
    } catch (e) {
        const { err, text } = messageOf(e, fallback);
        return SimpleResult.failure(text, err);
    }
};
```

`src/api/transport/createTransport.ts`:
```ts
import type { Interceptor, Transport } from "@connectrpc/connect";
import { restRoutes } from "./rest/routes";
import { createRestTransport } from "./rest/createRestTransport";
import type { TransportMode } from "./TransportMode";

export interface CreateTransportOptions {
    mode: TransportMode;
    /** Backend origin, e.g. "https://host:7070". */
    baseUrl: string;
    interceptors: Interceptor[];
    fetch?: typeof globalThis.fetch;
    defaultTimeoutMs?: number;
}

export const createTransport = (options: CreateTransportOptions): Transport => {
    switch (options.mode) {
        case "Rest":
            return createRestTransport({
                baseUrl: options.baseUrl,
                routes: restRoutes,
                fetch: options.fetch,
                interceptors: options.interceptors,
                defaultTimeoutMs: options.defaultTimeoutMs,
            });
        case "GrpcWeb":
            throw new Error("Transport mode GrpcWeb is not implemented yet.");
        case "Grpc":
            throw new Error("Transport mode Grpc is not implemented yet.");
    }
};
```

`src/api/clients.ts`:
```ts
import { createClient, type Client, type Transport } from "@connectrpc/connect";
import { AutomationsService } from "@/api/gen/automations/v1/automations_pb";
import { DataSourcesService } from "@/api/gen/datasources/v1/datasources_pb";
import { DashboardsService } from "@/api/gen/devices/v1/dashboards_pb";
import { DevicesService } from "@/api/gen/devices/v1/devices_pb";
import { OperationsService } from "@/api/gen/devices/v1/operations_pb";
import { SharingService as DevicesSharingService } from "@/api/gen/devices/v1/sharing_pb";
import { WidgetsService } from "@/api/gen/devices/v1/widgets_pb";
import { HomesService } from "@/api/gen/homes/v1/homes_pb";
import { RoomsService } from "@/api/gen/homes/v1/rooms_pb";
import { SharingService as HomesSharingService } from "@/api/gen/homes/v1/sharing_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { AccountService } from "@/api/gen/users/v1/account_pb";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { UsersService } from "@/api/gen/users/v1/users_pb";

export interface ApiClients {
    homes: Client<typeof HomesService>;
    rooms: Client<typeof RoomsService>;
    homeSharing: Client<typeof HomesSharingService>;
    devices: Client<typeof DevicesService>;
    dashboards: Client<typeof DashboardsService>;
    operations: Client<typeof OperationsService>;
    widgets: Client<typeof WidgetsService>;
    deviceSharing: Client<typeof DevicesSharingService>;
    automations: Client<typeof AutomationsService>;
    dataSources: Client<typeof DataSourcesService>;
    users: Client<typeof UsersService>;
    account: Client<typeof AccountService>;
    auth: Client<typeof AuthService>;
    legal: Client<typeof LegalService>;
    liveUpdates: Client<typeof LiveUpdatesService>;
}

export const createApiClients = (transport: Transport): ApiClients => ({
    homes: createClient(HomesService, transport),
    rooms: createClient(RoomsService, transport),
    homeSharing: createClient(HomesSharingService, transport),
    devices: createClient(DevicesService, transport),
    dashboards: createClient(DashboardsService, transport),
    operations: createClient(OperationsService, transport),
    widgets: createClient(WidgetsService, transport),
    deviceSharing: createClient(DevicesSharingService, transport),
    automations: createClient(AutomationsService, transport),
    dataSources: createClient(DataSourcesService, transport),
    users: createClient(UsersService, transport),
    account: createClient(AccountService, transport),
    auth: createClient(AuthService, transport),
    legal: createClient(LegalService, transport),
    liveUpdates: createClient(LiveUpdatesService, transport),
});
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: all suites pass (including the earlier `result.test.ts`).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/api/transport/createTransport.ts src/api/clients.ts src/api/call.ts src/utils/result.tsx tests/api/clients.test.ts tests/api/call.test.ts
git commit -m "feat: transport factory, typed api clients and Result call helper

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: ApiProvider mounted in the layout

**Files:**
- Create: `src/contexts/ApiProvider.tsx`
- Modify: `src/app/_layout.tsx:56-70`
- Modify: `AGENTS.md` (API Layer section)

**Interfaces:**
- Consumes: `createInterceptors`, `createTransport`, `createApiClients`, `useSession`, `useConfiguration`, `useToast`.
- Produces:
  ```ts
  export interface ApiContextValue extends ApiClients { transportMode: TransportMode }
  export const useApi: () => ApiContextValue;
  export const ApiProvider: FC<PropsWithChildren>;
  ```
  Later PRs (3–6) replace `useHttpClient()` with `useApi()`.

- [ ] **Step 1: Implement provider**

`src/contexts/ApiProvider.tsx`:
```tsx
import React, { createContext, FC, PropsWithChildren, useContext, useMemo, useRef } from "react";
import { createApiClients, type ApiClients } from "@/api/clients";
import { createInterceptors } from "@/api/interceptors";
import { createTransport } from "@/api/transport/createTransport";
import type { TransportMode } from "@/api/transport/TransportMode";
import { ApiError } from "@/api/errors";
import { useConfiguration } from "./ConfigurationProvider";
import { useSession } from "./SessionProvider";
import { useToast } from "./ToastProvider";

export interface ApiContextValue extends ApiClients {
    transportMode: TransportMode;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export const useApi = (): ApiContextValue => {
    const ctx = useContext(ApiContext);
    if (!ctx) {
        throw new Error("useApi must be used within ApiProvider.");
    }
    return ctx;
};

const RefreshFailureToastThreshold = 10;

export const ApiProvider: FC<PropsWithChildren> = ({ children }) => {
    const session = useSession();
    const configuration = useConfiguration();
    const toast = useToast();

    // Refs keep latest values accessible inside stable interceptors without rebuilding clients.
    const sessionRef = useRef(session);
    sessionRef.current = session;
    const toastRef = useRef(toast);
    toastRef.current = toast;
    const refreshFailureCountRef = useRef(0);

    const baseUrl = configuration.getBaseUrl().origin;
    const transportMode = configuration.transportMode;

    const value = useMemo<ApiContextValue>(() => {
        const interceptors = createInterceptors({
            getAccessToken: () => {
                const s = sessionRef.current.session;
                return s.authenticated && s.accessToken ? s.accessToken : null;
            },
            refresh: async () => {
                const token = await sessionRef.current.refresh();
                if (token) refreshFailureCountRef.current = 0;
                return token;
            },
            logout: () => sessionRef.current.logout(),
            onRefreshFailed: () => {
                refreshFailureCountRef.current++;
                if (refreshFailureCountRef.current >= RefreshFailureToastThreshold) {
                    refreshFailureCountRef.current = 0;
                    toastRef.current.error("Please check your internet connection.");
                }
            },
            onForbidden: (error) => {
                const text = ApiError.is(error) ? error.firstDescription() : error.rawMessage;
                toastRef.current.error(text || "Access denied.");
            },
        });

        const transport = createTransport({ mode: transportMode, baseUrl, interceptors });
        console.info(`[Api] Transport ${transportMode} → ${baseUrl}`);

        return { ...createApiClients(transport), transportMode };
    }, [baseUrl, transportMode]);

    return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};
```

- [ ] **Step 2: Mount in `_layout.tsx`**

Add import `import { ApiProvider } from "@/contexts/ApiProvider";` and wrap directly inside `HttpClientProvider`:
```tsx
<HttpClientProvider>
    <ApiProvider>
        <SignalRProvider>
            <UserProvider>
                <RootLayoutInner />
            </UserProvider>
        </SignalRProvider>
    </ApiProvider>
</HttpClientProvider>
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: clean. Note `createTransport` throws for `Grpc`/`GrpcWeb`; with `EXPO_PUBLIC_TRANSPORT_MODE` unset the mode is `Rest`, so the app boots unchanged.

- [ ] **Step 4: Smoke test on emulator**

Run: `npx expo run:android` (first build) or `npm start` then `a`.
Expected: app starts, login works exactly as before (still through `HttpClientProvider`), Metro log shows `[Api] Transport Rest → http://10.0.2.2:8080`.

- [ ] **Step 5: Document in AGENTS.md**

In the "API Layer" section add before the endpoints table:
```
- New (migration in progress): `useApi()` from `ApiProvider` exposes Connect clients generated from
  backend protos (`src/api/gen`). Transport chosen by `EXPO_PUBLIC_TRANSPORT_MODE`; REST transport
  maps RPCs to REST routes in `src/api/transport/rest/routes/`. Wrap calls with `call()` /
  `callSimple()` from `src/api/call.ts` to get `Result<T>` / `SimpleResult`.
- `useHttpClient()` remains until all call sites are migrated.
```

- [ ] **Step 6: Commit and open PR 2**

```bash
git add src/contexts/ApiProvider.tsx src/app/_layout.tsx AGENTS.md
git commit -m "feat: ApiProvider with rest transport and interceptor chain

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/transport-2-rest-transport
gh pr create --base feat/transport-1-scaffolding --title "feat: rest transport, interceptors and error model" --body "$(cat <<'EOF'
## Summary
- `createRestTransport`: Connect `Transport` backed by a declarative RPC→REST mapping table
- REST routes for `UsersService`, `LegalService`, `AuthService`
- Interceptors: bearer auth with deduplicated refresh + single retry, consent (`PermissionDenied`) logout, error normalisation into `ApiError`
- `ApiProvider` / `useApi()` mounted in the root layout; no call sites migrated yet

Part 2 of the transport abstraction stack, based on #<PR1>. Spec: `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md`.

## Test plan
- `npm test` (unit: transport, routes, interceptors, errors)
- App boots and logs `[Api] Transport Rest → <url>`; existing login/flows unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Replace `#<PR1>` with the number printed by Task 3 Step 8.

---

## Self-review

- Spec coverage for PR 1 + PR 2: codegen (Task 2), layout (Tasks 2, 6–11), mode selection without UI (Task 3; UI deferred to PR 8 per spec), RestTransport incl. status mapping, header forwarding, Unimplemented stream, `v1/user/settings` typo not reproduced (Task 7, 8), interceptors auth/legal/errors with shared refresh (Task 9), timeout as transport option (Task 7), ApiError incl. both REST problem shapes and gRPC trailers (Task 5), `Result` helper (Task 10), ApiProvider mount (Task 11). Not in this plan by design: gRPC-Web, native gRPC, OTel, live updates, call-site migration, other module routes.
- Placeholders: none. Each code step has full content.
- Type consistency: `RestProblem` (errors.ts) used by createRestTransport and toApiError; `routeKey` used in RestRoute, createRestTransport and tests; `AuthInterceptorDeps.onRefreshFailed` / `LegalInterceptorDeps.onForbidden` consumed by ApiProvider; `createTransport` options match ApiProvider call; `Result.error` added before `call.ts` uses it.
- Known risk: exact `runUnaryCall` option names and `UnaryRequest` fields depend on the installed `@connectrpc/connect` 2.x; Task 4 verifies before code is written.
