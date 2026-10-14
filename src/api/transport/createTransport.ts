import { Code, ConnectError, type Interceptor, type Transport } from "@connectrpc/connect";
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

/** Every call rejects with Unavailable; used when the backend is not configured. */
export const createUnavailableTransport = (reason: string): Transport => {
    const fail = () => Promise.reject(new ConnectError(reason, Code.Unavailable));
    return { unary: fail, stream: fail };
};

export const BaseUrlNotConfigured = "API base URL is not configured";

/**
 * Origin of the configured backend, or null when it is missing / invalid / opaque
 * (e.g. "localhost:8080" parses with origin "null"). Never throws.
 */
export const resolveBaseUrl = (getBaseUrl: () => URL): string | null => {
    try {
        const origin = getBaseUrl().origin;
        if (origin && origin !== "null") return origin;
        console.error(`[Api] Base URL has no usable origin (${origin}).`);
    } catch (e) {
        console.error("[Api] Base URL is not configured or invalid.", e);
    }
    return null;
};

export interface ResolveTransportOptions extends Omit<CreateTransportOptions, "baseUrl"> {
    baseUrl: string | null;
}

/**
 * Builds the transport for the requested mode without throwing: a missing base URL yields the
 * unavailable transport and an unimplemented mode falls back to Rest. `mode` is the effective mode.
 */
export const resolveTransport = (
    options: ResolveTransportOptions,
): { transport: Transport; mode: TransportMode } => {
    const { baseUrl } = options;
    if (!baseUrl) {
        return { transport: createUnavailableTransport(BaseUrlNotConfigured), mode: options.mode };
    }
    try {
        return { transport: createTransport({ ...options, baseUrl }), mode: options.mode };
    } catch (e) {
        console.error(`[Api] Transport ${options.mode} unavailable, falling back to Rest.`, e);
        return { transport: createTransport({ ...options, baseUrl, mode: "Rest" }), mode: "Rest" };
    }
};
