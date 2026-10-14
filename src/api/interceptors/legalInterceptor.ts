import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";

export interface LegalInterceptorDeps {
    logout: () => void;
    /** Receives the original error so the provider can toast its description. */
    onForbidden: (error: ApiError | ConnectError) => void;
}

// PermissionDenied is only returned by LegalMiddleware / LegalConsentInterceptor
// when the user has not accepted the latest terms. Same rule as the old 403 handling.
export const createLegalInterceptor =
    (deps: LegalInterceptorDeps): Interceptor =>
    (next) =>
    async (req) => {
        try {
            return await next(req);
        } catch (e) {
            const code = ApiError.is(e) ? e.code : ConnectError.from(e).code;
            if (code === Code.PermissionDenied) {
                deps.logout();
                console.warn("[Api] Logged out due to PermissionDenied (missing consents).");
                deps.onForbidden(ApiError.is(e) ? e : ConnectError.from(e));
            }
            throw e;
        }
    };
