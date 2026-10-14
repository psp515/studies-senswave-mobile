import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";

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
            // Streams are exempt: a revoked home share (PermissionDenied on the live-update stream)
            // must not end the session. Consequence: if consents were revoked, the stream just ends
            // (terminal, no retry) and the user is logged out by the next unary call, not here.
            const isLiveStream = req.stream || req.service.typeName === LiveUpdatesService.typeName;
            if (code === Code.PermissionDenied && !isLiveStream) {
                deps.logout();
                console.warn("[Api] Logged out due to PermissionDenied (missing consents).");
                deps.onForbidden(ApiError.is(e) ? e : ConnectError.from(e));
            }
            throw e;
        }
    };
