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
