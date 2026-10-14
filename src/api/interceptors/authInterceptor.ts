import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";
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

// The error interceptor is innermost, so failures arrive here as ApiError.
const codeOf = (e: unknown): Code => (ApiError.is(e) ? e.code : ConnectError.from(e).code);
const isUnauthenticated = (e: unknown) => codeOf(e) === Code.Unauthenticated;

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
