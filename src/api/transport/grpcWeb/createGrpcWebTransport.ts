import type { Interceptor, Transport } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { streamingFetch } from "@/api/polyfills";

export interface GrpcWebTransportOptions {
    /** Origin of the backend, e.g. "https://host:7070". */
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
    interceptors?: Interceptor[];
    defaultTimeoutMs?: number;
}

export const createSenswaveGrpcWebTransport = (options: GrpcWebTransportOptions): Transport =>
    createGrpcWebTransport({
        baseUrl: options.baseUrl,
        useBinaryFormat: true,
        fetch: options.fetch ?? streamingFetch,
        interceptors: options.interceptors,
        defaultTimeoutMs: options.defaultTimeoutMs ?? 15000,
    });
