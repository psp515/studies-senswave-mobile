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
