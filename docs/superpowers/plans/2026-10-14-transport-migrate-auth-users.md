# Transport Migration — Auth, Legal, Users Implementation Plan (PR 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `SessionProvider`, `LegalProvider` and `UserProvider` off raw `fetch`/`HttpClientProvider` onto the generated Connect clients, so auth, legal and user flows work over any transport.

**Architecture:** `SessionProvider` and `LegalProvider` sit above `ApiProvider`, so a small `AnonymousApiProvider` (Configuration > AnonymousApi > Legal > Session) exposes `auth` and `legal` clients built with only the error interceptor. `UserProvider` (inside `ApiProvider`) uses `useApi().users`. Error-to-message rules that today live inline in `SessionProvider` move into pure, tested helpers in `src/api/authErrors.ts`. `ToastProvider` gains `apiError(result)` which stays silent for codes the interceptors already handled.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript 5.9 strict, `@connectrpc/connect` 2.2, `@bufbuild/protobuf` 2.16 (`timestampDate` from `@bufbuild/protobuf/wkt`), jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-14-transport-abstraction-design.md` (§3 "SessionProvider and LegalProvider", §5 migration rules)

## Global Constraints

- TypeScript strict; `npm run typecheck`, `npm run lint`, `npm test` green after every task.
- Prettier: 4-space indent, double quotes, trailing commas, print width 100. Components typed `FC`.
- Never call `fetch` outside `src/utils/httpClient.tsx` and `src/api/transport/rest/`. After this PR, `executeTimeout` is used only by `ConfigurationProvider.isAppCompatibleWithApi()` and `SessionProvider.loginGoogle()`.
- Callers consume api errors only through `call()` / `callSimple()` / `toApiError()`; never inspect a raw caught error.
- Public context APIs (`useSession()`, `useLegal()`, `useUser()`) keep their current method names and return types, so screens do not change except where this plan says so.
- User-facing message strings keep today's wording: "Please confirm your email.", "Invalid email or password.", "Server not available.", "Login failed unexpectedly.", "Something went wrong.", "Failed to update theme.", "Failed to update language.", "Failed to make consents.", "Failed to remove account.", "Service unavailable".
- Google login stays on the raw REST call (`v1/auth/login/google`) and the Google button is hidden when `transportMode !== "Rest"`.
- Commit messages `feat:` / `fix:` / `chore:` ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never commit `.env` or `.superpowers/`.
- Branch: `feat/transport-3-auth-users` based on `feat/transport-2-rest-transport` (657f321). Working directory `E:\ssm`.

---

## File map

| File | Responsibility |
|---|---|
| `src/api/authErrors.ts` | Pure mappers: `loginFailure(err)`, `identityValidationFailure(err, fallback)`, `serverFailureText(err, fallback)` |
| `tests/api/authErrors.test.ts` | |
| `src/api/anonymousClients.ts` | `createAnonymousApi(baseUrl, mode)` → `{ auth, legal, transportMode }` |
| `tests/api/anonymousClients.test.ts` | |
| `src/contexts/AnonymousApiProvider.tsx` | context + `useAnonymousApi()` |
| `src/contexts/ToastProvider.tsx` | add `apiError(result: { isSuccess; errorMessage; error? }, fallback?)` |
| `tests/contexts/toastApiError.test.ts` | tests the pure decision helper `shouldToastApiError` |
| `src/contexts/domain/LegalProvider.tsx` | use `useAnonymousApi().legal` |
| `src/contexts/SessionProvider.tsx` | use `useAnonymousApi().auth` for all flows except Google |
| `src/components/auth/GoogleSignInButton.tsx` | hide when `transportMode !== "Rest"` |
| `src/contexts/domain/UserProvider.tsx` | use `useApi().users` |
| `src/app/_layout.tsx` | mount `AnonymousApiProvider` |
| `AGENTS.md` | consent flow + provider order notes |

---

### Task 1: Auth error mappers

**Files:**
- Create: `src/api/authErrors.ts`
- Create: `tests/api/authErrors.test.ts`

**Interfaces:**
- Consumes: `ApiError`, `toApiError` from `@/api/errors`; `Code` from `@connectrpc/connect`; `Result`, `SimpleResult` from `@/utils/result`.
- Produces:
  ```ts
  export const ServerUnavailableText = "Server not available.";
  export function isServerFailure(err: ApiError): boolean;             // Unavailable | DeadlineExceeded | Internal | Unknown
  export function loginFailure(reason: unknown): Result<boolean>;      // data = show "resend confirmation" button
  export function identityValidationFailure(reason: unknown, fallback: string): SimpleResult;
  ```
  Rules (today's behaviour, see `SessionProvider.tsx:225-247, 379-399`):
  - `loginFailure`: `Unauthenticated` + `message === "NotAllowed"` → `failureWithData("Please confirm your email.", true)`; other `Unauthenticated` → `failureWithData("Invalid email or password.", false)`; server failure → `failureWithData("Server not available.", false)`; else `failureWithData("Login failed unexpectedly.", false)`. Attach `err` on the result.
  - `identityValidationFailure`: `InvalidArgument` → first `errors[]` entry whose `code !== "DuplicateUserName"` and has a non-empty `description` → `failure(description)`; none → `failure("Something went wrong.")`; server failure → `failure("Server not available.")`; else `failure(fallback)`.

- [ ] **Step 1: Failing tests**

`tests/api/authErrors.test.ts`:
```ts
import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { ApiError } from "@/api/errors";
import { identityValidationFailure, isServerFailure, loginFailure } from "@/api/authErrors";

const apiError = (code: Code, message = "", errors: { code: string; description: string }[] = []) =>
    new ApiError({
        code,
        message,
        errors: errors.map((e) => create(ErrorSchema, { ...e, type: ErrorType.VALIDATION })),
    });

describe("isServerFailure", () => {
    it.each([Code.Unavailable, Code.DeadlineExceeded, Code.Internal, Code.Unknown])("%s → true", (c) => {
        expect(isServerFailure(apiError(c))).toBe(true);
    });
    it("Unauthenticated → false", () => {
        expect(isServerFailure(apiError(Code.Unauthenticated))).toBe(false);
    });
});

describe("loginFailure", () => {
    it("NotAllowed → confirm email, show resend", () => {
        const r = loginFailure(apiError(Code.Unauthenticated, "NotAllowed"));
        expect(r.isSuccess).toBe(false);
        expect(r.errorMessage).toBe("Please confirm your email.");
        expect(r.data).toBe(true);
        expect(r.error?.code).toBe(Code.Unauthenticated);
    });
    it("other Unauthenticated → invalid credentials", () => {
        const r = loginFailure(apiError(Code.Unauthenticated, "Failed"));
        expect(r.errorMessage).toBe("Invalid email or password.");
        expect(r.data).toBe(false);
    });
    it("server failure", () => {
        expect(loginFailure(apiError(Code.Unavailable)).errorMessage).toBe("Server not available.");
    });
    it("anything else", () => {
        expect(loginFailure(new Error("boom")).errorMessage).toBe("Login failed unexpectedly.");
        expect(loginFailure(apiError(Code.NotFound)).errorMessage).toBe("Login failed unexpectedly.");
    });
});

describe("identityValidationFailure", () => {
    it("picks first non-DuplicateUserName description", () => {
        const r = identityValidationFailure(
            apiError(Code.InvalidArgument, "", [
                { code: "DuplicateUserName", description: "Username taken" },
                { code: "PasswordTooShort", description: "Passwords must be at least 6 characters." },
            ]),
            "Registration failed unexpectedly.",
        );
        expect(r.errorMessage).toBe("Passwords must be at least 6 characters.");
    });
    it("only DuplicateUserName → Something went wrong.", () => {
        const r = identityValidationFailure(
            apiError(Code.InvalidArgument, "", [{ code: "DuplicateUserName", description: "x" }]),
            "fallback",
        );
        expect(r.errorMessage).toBe("Something went wrong.");
    });
    it("server failure", () => {
        expect(identityValidationFailure(apiError(Code.Internal), "fb").errorMessage).toBe("Server not available.");
    });
    it("other codes → fallback", () => {
        expect(identityValidationFailure(apiError(Code.NotFound), "fb").errorMessage).toBe("fb");
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/authErrors.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

`src/api/authErrors.ts`:
```ts
import { Code } from "@connectrpc/connect";
import { Result, SimpleResult } from "@/utils/result";
import { toApiError, type ApiError } from "./errors";

export const ServerUnavailableText = "Server not available.";
const SomethingWentWrongText = "Something went wrong.";

export const isServerFailure = (err: ApiError): boolean =>
    err.code === Code.Unavailable ||
    err.code === Code.DeadlineExceeded ||
    err.code === Code.Internal ||
    err.code === Code.Unknown;

/** Result data tells the login screen whether to show the "resend confirmation email" button. */
export const loginFailure = (reason: unknown): Result<boolean> => {
    const err = toApiError(reason);

    if (err.code === Code.Unauthenticated) {
        // Identity SignInResult.ToString(): "NotAllowed" means the email is not confirmed yet.
        if (err.message === "NotAllowed") {
            return Result.failureWithData<boolean>("Please confirm your email.", true, err);
        }
        return Result.failureWithData<boolean>("Invalid email or password.", false, err);
    }

    if (isServerFailure(err)) {
        return Result.failureWithData<boolean>(ServerUnavailableText, false, err);
    }

    return Result.failureWithData<boolean>("Login failed unexpectedly.", false, err);
};

/** Identity validation problems (register, reset password): first useful description wins. */
export const identityValidationFailure = (reason: unknown, fallback: string): SimpleResult => {
    const err = toApiError(reason);

    if (err.code === Code.InvalidArgument) {
        const first = err.errors.find((e) => e.code !== "DuplicateUserName" && e.description.trim());
        return SimpleResult.failure(first ? first.description : SomethingWentWrongText, err);
    }

    if (isServerFailure(err)) {
        return SimpleResult.failure(ServerUnavailableText, err);
    }

    return SimpleResult.failure(fallback, err);
};
```

- [ ] **Step 4: Run, expect pass; lint; typecheck; commit**

```bash
npm test -- tests/api/authErrors.test.ts && npm run lint && npm run typecheck
git add src/api/authErrors.ts tests/api/authErrors.test.ts
git commit -m "feat: auth error mappers for login and identity validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Anonymous api clients and provider

**Files:**
- Create: `src/api/anonymousClients.ts`
- Create: `tests/api/anonymousClients.test.ts`
- Create: `src/contexts/AnonymousApiProvider.tsx`
- Modify: `src/app/_layout.tsx` (mount between `ConfigurationProvider` and `LegalProvider`)

**Interfaces:**
- Consumes: `resolveBaseUrl`, `resolveTransport` from `@/api/transport/createTransport`; `createErrorInterceptor` from `@/api/interceptors`; `AuthService`, `LegalService` descriptors; `useConfiguration()` (`getBaseUrl`, `transportMode`).
- Produces:
  ```ts
  export interface AnonymousApi { auth: Client<typeof AuthService>; legal: Client<typeof LegalService>; transportMode: TransportMode }
  export function createAnonymousApi(options: { baseUrl: string | null; mode: TransportMode; fetch?: typeof fetch }): AnonymousApi;
  export const useAnonymousApi: () => AnonymousApi;   // throws outside provider
  export const AnonymousApiProvider: FC<PropsWithChildren>;
  ```

- [ ] **Step 1: Failing test**

`tests/api/anonymousClients.test.ts`:
```ts
import { Code } from "@connectrpc/connect";
import { createAnonymousApi } from "@/api/anonymousClients";
import { call } from "@/api/call";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("createAnonymousApi", () => {
    it("calls auth.login over REST without Authorization header", async () => {
        let headers: Headers | undefined;
        const api = createAnonymousApi({
            baseUrl: "https://h",
            mode: "Rest",
            fetch: async (_u, init) => {
                headers = new Headers(init?.headers);
                return json(200, { tokenType: "Bearer", accessToken: "a", expiresIn: 1, refreshToken: "r" });
            },
        });
        const r = await call(() => api.auth.login({ email: "e", password: "p" }));
        expect(r.isSuccess).toBe(true);
        expect(r.data?.accessToken).toBe("a");
        expect(headers?.get("Authorization")).toBeNull();
        expect(api.transportMode).toBe("Rest");
    });

    it("surfaces ApiError with code and message from a 401 problem", async () => {
        const api = createAnonymousApi({
            baseUrl: "https://h",
            mode: "Rest",
            fetch: async () => json(401, { title: "Unauthorized", detail: "NotAllowed", status: 401 }),
        });
        const r = await call(() => api.auth.login({ email: "e", password: "p" }));
        expect(r.error?.code).toBe(Code.Unauthenticated);
        expect(r.error?.message).toBe("NotAllowed");
    });

    it("missing base URL yields Unavailable without throwing", async () => {
        const api = createAnonymousApi({ baseUrl: null, mode: "Rest" });
        const r = await call(() => api.legal.getTermsAndConditions({}));
        expect(r.error?.code).toBe(Code.Unavailable);
    });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/anonymousClients.test.ts`

- [ ] **Step 3: Implement**

`src/api/anonymousClients.ts`:
```ts
import { createClient, type Client } from "@connectrpc/connect";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { createErrorInterceptor } from "./interceptors";
import { resolveTransport } from "./transport/createTransport";
import type { TransportMode } from "./transport/TransportMode";

export interface AnonymousApi {
    auth: Client<typeof AuthService>;
    legal: Client<typeof LegalService>;
    /** Effective mode after fallback. */
    transportMode: TransportMode;
}

export interface CreateAnonymousApiOptions {
    baseUrl: string | null;
    mode: TransportMode;
    fetch?: typeof globalThis.fetch;
}

/**
 * Clients for the services the backend serves without authentication. Used by providers that
 * sit above ApiProvider (SessionProvider, LegalProvider). Only the error interceptor applies.
 */
export const createAnonymousApi = (options: CreateAnonymousApiOptions): AnonymousApi => {
    const { transport, mode } = resolveTransport({
        baseUrl: options.baseUrl,
        mode: options.mode,
        interceptors: [createErrorInterceptor()],
        fetch: options.fetch,
    });
    return {
        auth: createClient(AuthService, transport),
        legal: createClient(LegalService, transport),
        transportMode: mode,
    };
};
```

`src/contexts/AnonymousApiProvider.tsx`:
```tsx
import React, { createContext, FC, PropsWithChildren, useContext, useMemo } from "react";
import { createAnonymousApi, type AnonymousApi } from "@/api/anonymousClients";
import { resolveBaseUrl } from "@/api/transport/createTransport";
import { useConfiguration } from "./ConfigurationProvider";

const AnonymousApiContext = createContext<AnonymousApi | null>(null);

export const useAnonymousApi = (): AnonymousApi => {
    const ctx = useContext(AnonymousApiContext);
    if (!ctx) {
        throw new Error("useAnonymousApi must be used within AnonymousApiProvider.");
    }
    return ctx;
};

export const AnonymousApiProvider: FC<PropsWithChildren> = ({ children }) => {
    const configuration = useConfiguration();

    const baseUrl = resolveBaseUrl(() => configuration.getBaseUrl()) ?? "";
    const mode = configuration.transportMode;

    const value = useMemo(
        () => createAnonymousApi({ baseUrl: baseUrl || null, mode }),
        [baseUrl, mode],
    );

    return <AnonymousApiContext.Provider value={value}>{children}</AnonymousApiContext.Provider>;
};
```

`src/app/_layout.tsx`: import `AnonymousApiProvider` and nest:
```tsx
<ConfigurationProvider>
    <AnonymousApiProvider>
        <LegalProvider>
            <SessionProvider>
                ...unchanged...
            </SessionProvider>
        </LegalProvider>
    </AnonymousApiProvider>
</ConfigurationProvider>
```

- [ ] **Step 4: Run, lint, typecheck, commit**

```bash
npm test -- tests/api/anonymousClients.test.ts && npm run lint && npm run typecheck
git add src/api/anonymousClients.ts tests/api/anonymousClients.test.ts src/contexts/AnonymousApiProvider.tsx src/app/_layout.tsx
git commit -m "feat: anonymous api clients for auth and legal above ApiProvider

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `toast.apiError`

**Files:**
- Create: `src/api/toastDecision.ts`
- Create: `tests/api/toastDecision.test.ts`
- Modify: `src/contexts/ToastProvider.tsx`

**Interfaces:**
- Produces:
  ```ts
  // src/api/toastDecision.ts
  export interface FailedResultLike { isSuccess: boolean; errorMessage: string | null; error?: ApiError }
  export function toastTextFor(result: FailedResultLike, fallback?: string): string | null;
  // null = stay silent (success, or Unauthenticated / PermissionDenied which the interceptors already handled with logout + toast)
  // ToastProvider
  apiError: (result: FailedResultLike, fallback?: string) => void;
  ```
  `httpError` stays until the last `useHttpClient` caller is gone (PR 6).

- [ ] **Step 1: Failing test**

`tests/api/toastDecision.test.ts`:
```ts
import { Code } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";
import { toastTextFor } from "@/api/toastDecision";

const failed = (code: Code | undefined, errorMessage: string | null) => ({
    isSuccess: false,
    errorMessage,
    error: code === undefined ? undefined : new ApiError({ code, message: "" }),
});

describe("toastTextFor", () => {
    it("success → null", () => {
        expect(toastTextFor({ isSuccess: true, errorMessage: null })).toBeNull();
    });
    it("Unauthenticated and PermissionDenied → null (already handled)", () => {
        expect(toastTextFor(failed(Code.Unauthenticated, "x"))).toBeNull();
        expect(toastTextFor(failed(Code.PermissionDenied, "x"))).toBeNull();
    });
    it("other failure → errorMessage", () => {
        expect(toastTextFor(failed(Code.NotFound, "Missing"))).toBe("Missing");
    });
    it("failure without message → fallback", () => {
        expect(toastTextFor(failed(undefined, null), "Oops")).toBe("Oops");
        expect(toastTextFor(failed(undefined, ""))).toBe("An unexpected error occurred.");
    });
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

`src/api/toastDecision.ts`:
```ts
import { Code } from "@connectrpc/connect";
import type { ApiError } from "./errors";

export interface FailedResultLike {
    isSuccess: boolean;
    errorMessage: string | null;
    error?: ApiError;
}

export const DefaultErrorToastText = "An unexpected error occurred.";

/** Codes the interceptor chain already reacted to (logout + toast). Callers stay silent. */
const HandledCodes: ReadonlySet<Code> = new Set([Code.Unauthenticated, Code.PermissionDenied]);

export const toastTextFor = (
    result: FailedResultLike,
    fallback: string = DefaultErrorToastText,
): string | null => {
    if (result.isSuccess) return null;
    if (result.error && HandledCodes.has(result.error.code)) return null;
    const text = result.errorMessage?.trim();
    return text ? text : fallback;
};
```

`src/contexts/ToastProvider.tsx`: add to the interface `apiError: (result: FailedResultLike, fallback?: string) => void;`, default `apiError: () => { console.debug("[Toast Context] Not initialized."); }`, and in the provider:
```ts
    const apiError = (result: FailedResultLike, fallback?: string) => {
        const text = toastTextFor(result, fallback);
        if (text) error(text);
    };
```
Include `apiError` in the provider value. Import `FailedResultLike`, `toastTextFor` from `@/api/toastDecision`.

- [ ] **Step 4: Run, lint, typecheck, commit**

```bash
npm test -- tests/api/toastDecision.test.ts && npm run lint && npm run typecheck
git add src/api/toastDecision.ts tests/api/toastDecision.test.ts src/contexts/ToastProvider.tsx
git commit -m "feat: toast.apiError for Result failures from api clients

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: LegalProvider on anonymous api

**Files:**
- Modify: `src/contexts/domain/LegalProvider.tsx`

**Interfaces:**
- Consumes: `useAnonymousApi().legal`, `call`, `timestampDate` from `@bufbuild/protobuf/wkt`.
- Produces: unchanged `useLegal()` → `{ getTerms(): Promise<Result<LegalDocument>>, getPrivacy(): Promise<Result<LegalDocument>> }`; `LegalDocument { id, version, content, summary, createdAtUtc: string (ISO) }` unchanged.

- [ ] **Step 1: Rewrite provider**

Replace the two fetch-based functions with:
```tsx
import { useAnonymousApi } from "@/contexts/AnonymousApiProvider";
import { call } from "@/api/call";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { GetPrivacyPolicyResponse, GetTermsAndConditionsResponse } from "@/api/gen/users/v1/legal_pb";

const ServiceUnavailableText = "Service unavailable";

const toLegalDocument = (r: GetPrivacyPolicyResponse | GetTermsAndConditionsResponse): LegalDocument => ({
    id: r.id,
    version: r.version,
    content: r.content,
    summary: r.summary,
    createdAtUtc: r.createdAtUtc ? timestampDate(r.createdAtUtc).toISOString() : "",
});

export const LegalProvider: FC<PropsWithChildren> = ({ children }) => {
    const api = useAnonymousApi();

    const getTerms = async (): Promise<Result<LegalDocument>> => {
        const result = await call(() => api.legal.getTermsAndConditions({}), ServiceUnavailableText);
        if (result.isSuccess) {
            console.info("[LegalProvider] Successfully fetched Terms and Conditions.");
            return Result.success(toLegalDocument(result.data!));
        }
        console.error("[LegalProvider] Failed to fetch Terms and Conditions.");
        return Result.failure<LegalDocument>(ServiceUnavailableText, result.error);
    };

    const getPrivacy = async (): Promise<Result<LegalDocument>> => {
        const result = await call(() => api.legal.getPrivacyPolicy({}), ServiceUnavailableText);
        if (result.isSuccess) {
            console.info("[LegalProvider] Successfully fetched Privacy Policy.");
            return Result.success(toLegalDocument(result.data!));
        }
        console.error("[LegalProvider] Failed to fetch Privacy Policy.");
        return Result.failure<LegalDocument>(ServiceUnavailableText, result.error);
    };
    // ...rest unchanged
```
Remove the `executeTimeout` and `useConfiguration` imports.

- [ ] **Step 2: Lint, typecheck, test, commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/contexts/domain/LegalProvider.tsx
git commit -m "feat: LegalProvider uses anonymous legal client

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: SessionProvider on anonymous auth client

**Files:**
- Modify: `src/contexts/SessionProvider.tsx`
- Modify: `src/components/auth/GoogleSignInButton.tsx`

**Interfaces:**
- Consumes: `useAnonymousApi().auth`, `call`, `callSimple`, `loginFailure`, `identityValidationFailure`, `isServerFailure`, `ServerUnavailableText`; `Code` from `@connectrpc/connect`; `AccessTokenResponse` from `@/api/gen/users/v1/auth_pb`.
- Produces: `useSession()` unchanged in shape. `Tokens` type stays `{ tokenType, refreshToken, accessToken }`; add `const toTokens = (r: AccessTokenResponse): Tokens => ({ tokenType: r.tokenType, accessToken: r.accessToken, refreshToken: r.refreshToken })`.

- [ ] **Step 1: Replace each flow**

`resendEmailConfirmationMessage(email)`:
```ts
const result = await callSimple(() => api.auth.resendConfirmationEmail({ email }), "Failed to resend confirmation email");
if (result.isSuccess) { console.info("[Session Provider] Confirmation email was resend."); return result; }
if (result.error && isServerFailure(result.error)) return SimpleResult.failure("Server not available", result.error);
console.error("[Session Provider] Failed to resend confirmation email.");
return result;
```

`confirmEmail(userId, code)`:
```ts
const result = await callSimple(() => api.auth.confirmEmail({ userId, code }), "Failed to confirm email.");
if (result.isSuccess) console.debug("[Session Provider] Email confirmed successfully.");
else console.debug(`[Session Provider] Confirm email failed: ${result.error?.code}`);
return result.isSuccess ? result : SimpleResult.failure("Failed to confirm email.", result.error);
```

`login(email, password)`:
```ts
setSession({ ...session, loading: true });
const result = await call(() => api.auth.login({ email, password }));
if (result.isSuccess) {
    successfulLogin(toTokens(result.data!));
    return Result.success<boolean>(false);
}
setSession(Unauthenticated);
console.debug(`[Session Provider] Login failed: ${result.error?.code}`);
return loginFailure(result.error);
```
(keep the surrounding try/catch that sets `Unauthenticated` and returns "Login failed unexpectedly." on a thrown error.)

`refresh()`:
```ts
if (!session.refreshToken) { setSession(Unauthenticated); return null; }
const result = await call(() => api.auth.refresh({ refreshToken: session.refreshToken }));
if (result.isSuccess) {
    const data = toTokens(result.data!);
    await SecureStore.setItemAsync(AccessTokenName, data.accessToken);
    await SecureStore.setItemAsync(RefreshTokenName, data.refreshToken);
    setSession({ loading: false, authenticated: true, accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
}
if (result.error?.code === Code.Unauthenticated) {
    setSession(Unauthenticated);
    router.replace("start");
    console.error("[Session Provider] Refresh token invalid, logging out.");
    return null;
}
// Network/server error — preserve session, let caller decide
setSession({ ...session, loading: false });
console.warn(`[Session Provider] Refresh error: ${result.error?.code}`);
return null;
```

`register(email, password)`:
```ts
const result = await callSimple(() => api.auth.register({ email, password }));
if (result.isSuccess) { console.debug("[Session Provider] User registered successfully."); return result; }
console.debug(`[Session Provider] Registration failed: ${result.error?.code}`);
return identityValidationFailure(result.error, "Registration failed unexpectedly.");
```

`forgotPassword(email)`: `callSimple(() => api.auth.forgotPassword({ email }), "Forgot password failed unexpectedly.")`; success → log + return; failure → log and return `SimpleResult.failure("Forgot password failed unexpectedly.", result.error)`. Keep the `finally` that clears `loading`.

`resetPassword(email, password, resetCode)`: `callSimple(() => api.auth.resetPassword({ email, resetCode, newPassword: password }))`; success → return; failure → `identityValidationFailure(result.error, "Reset password failed unexpectedly.")`. Keep `finally`.

`initialize()` startup refresh: replace the `executeTimeout` block with
```ts
const result = await call(() => api.auth.refresh({ refreshToken }));
if (result.isSuccess) { await successfulLogin(toTokens(result.data!)); return; }
console.error(`[Session Provider] Refresh failed: ${result.error?.code}`);
setSession({ ...session, loading: false });
```

`loginGoogle` stays on `executeTimeout` unchanged. Remove now-unused imports; keep `executeTimeout` import for `loginGoogle`.

Add `const api = useAnonymousApi();` at the top of the provider.

- [ ] **Step 2: Hide Google button off REST**

`src/components/auth/GoogleSignInButton.tsx`: `const configuration = useConfiguration();` and at the top of the render: `if (configuration.transportMode !== "Rest") return null;` (before any other hooks are skipped — place after all hook calls).

- [ ] **Step 3: Lint, typecheck, test**

```bash
npm run lint && npm run typecheck && npm test
```

- [ ] **Step 4: Manual smoke (if an Android emulator is running — `adb devices`)**

`npm start` → `a`. Verify: login with wrong password toasts "Invalid email or password."; login with an unconfirmed account shows the resend button; successful login lands on `/consents`; app restart auto-logs in via stored refresh token. If no emulator, state it in the report.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/SessionProvider.tsx src/components/auth/GoogleSignInButton.tsx
git commit -m "feat: SessionProvider uses anonymous auth client for all non-Google flows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: UserProvider on `useApi().users`

**Files:**
- Modify: `src/contexts/domain/UserProvider.tsx`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `useApi().users`, `call`, `callSimple`, `toast.apiError`.
- Produces: `useUser()` unchanged.

- [ ] **Step 1: Rewrite calls**

```ts
const api = useApi();   // replaces useHttpClient()

updateTheme: const result = await callSimple(() => api.users.updateSettings({ theme: internalTheme }), "Failed to update theme.");
   success → setUserData + updateThemeInternal; failure → toast.apiError(result); return SimpleResult.failure("Failed to update theme.", result.error)
updateLanguage: callSimple(() => api.users.updateSettings({ language }), "Failed to update language.") — same pattern (this fixes the old `v1/user/settings` typo).
makeConsents: callSimple(() => api.users.createConsents({}), "Failed to make consents.") — same pattern.
getUserData: const result = await call(() => api.users.getUser({}), "Failed to update.");
   success → data = result.data!; theme = data.theme as ThemeMode; build UserData exactly as today (name derived from email); failure → toast.apiError(result); return Result.failure<UserData>("Failed to update.", result.error)
removeUserAccount: callSimple(() => api.users.deleteAccount({}), "Failed to remove account.") → success: session.logout(); failure: toast.apiError(result) + return failure with error.
```
Remove `UserResponse` type and the `useHttpClient` import. Note `theme` arrives as a plain string from proto; cast to `ThemeMode` with a guard: `Object.values(ThemeMode).includes(data.theme as ThemeMode) ? (data.theme as ThemeMode) : ThemeMode.Default`.

- [ ] **Step 2: AGENTS.md**

In "API Layer": update the Consent flow step 2 to "App fetches `users.getUser` via `useApi()`" and add under the migration note: "Migrated: `SessionProvider` (except Google), `LegalProvider`, `UserProvider`. Provider order: Configuration > AnonymousApi > Legal > Session > Theme > HttpClient > Api > SignalR > User."

- [ ] **Step 3: Lint, typecheck, test, smoke (profile: change theme + language; consents screen), commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/contexts/domain/UserProvider.tsx AGENTS.md
git commit -m "feat: UserProvider uses users api client

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- Spec coverage §3 SessionProvider/LegalProvider: anonymous factory (T2), auth flows + NotAllowed via `message` (T1, T5), Identity validation shape (T1), Google hidden off REST (T5), LegalProvider (T4). §5 migration for users module (T6). Toast convention from final-review I4 (T3).
- Placeholders: none; each code step has content. T5/T6 give per-function replacement code rather than full-file listings because the surrounding provider code (state, SecureStore, router) is unchanged and visible in the file.
- Type consistency: `Result.failureWithData(msg, data, err)` and `SimpleResult.failure(msg, err)` match the PR-2 signatures; `toTokens` defined in T5 and used by login/refresh/initialize; `FailedResultLike` matches `Result`/`SimpleResult` fields; `useAnonymousApi` from T2 used in T4/T5.
