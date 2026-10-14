import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { createAsyncIterable } from "@connectrpc/connect/protocol";
import { ApiError } from "@/api/errors";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { LegalService } from "@/api/gen/users/v1/legal_pb";

export interface AuthInterceptorDeps {
    /** Current access token, or null when there is no authenticated session. */
    getAccessToken: () => string | null;
    /** Refreshes the session; resolves with the new access token or null when refresh failed. */
    refresh: () => Promise<string | null>;
    logout: () => void;
    /**
     * Called when a refresh fails, once per waiting caller (concurrent callers share one refresh
     * but each reports its own failure), so the provider can count failures and toast.
     */
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
                .catch((e: unknown) => {
                    console.warn("[Api] Refresh threw", e);
                    return null;
                })
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

        const sentToken = deps.getAccessToken();
        if (!sentToken) {
            deps.logout();
            console.error("[Api] User is not authenticated.");
            throw new ApiError({ code: Code.Unauthenticated, message: "Not authenticated" });
        }

        req.header.set("Authorization", `Bearer ${sentToken}`);

        // A stream request message is a single-use async iterable that the transport drains, so
        // buffer it once and hand every attempt a fresh iterable. Only server streams are retried:
        // client/bidi request streams cannot be replayed.
        const serverStream = req.stream && req.method.methodKind === "server_streaming";
        let attempt: (r: typeof req) => ReturnType<typeof next> = (r) => next(r);
        if (serverStream) {
            const msgs: unknown[] = [];
            for await (const m of req.message as AsyncIterable<unknown>) msgs.push(m);
            attempt = (r) => next({ ...r, message: createAsyncIterable(msgs) } as typeof req);
        }

        try {
            return await attempt(req);
        } catch (e) {
            // Streams retry too, but only while next() rejects: that is before the response started
            // (trailers-only error). Errors while iterating messages never reach this catch.
            if (!isUnauthenticated(e) || (req.stream && !serverStream)) throw e;

            // Late 401 for a request sent before another caller finished a refresh:
            // the session already holds a newer token, so retry with it instead of refreshing again.
            const current = deps.getAccessToken();
            if (current && current !== sentToken) {
                req.header.set("Authorization", `Bearer ${current}`);
                return attempt(req);
            }

            const newToken = await refreshOnce();
            if (!newToken) {
                console.error("[Api] Failed to refresh auth token");
                deps.onRefreshFailed();
                throw e;
            }

            req.header.set("Authorization", `Bearer ${newToken}`);
            return attempt(req);
        }
    };
};
