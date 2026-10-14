import type {
    DescMessage,
    DescMethodStreaming,
    DescMethodUnary,
    MessageInitShape,
} from "@bufbuild/protobuf";
import { create } from "@bufbuild/protobuf";
import {
    Code,
    ConnectError,
    createContextValues,
    type ContextValues,
    type Interceptor,
    type StreamResponse,
    type Transport,
    type UnaryResponse,
} from "@connectrpc/connect";
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
                timeoutMs: timeoutMs ?? defaultTimeoutMs,
                req: {
                    stream: false,
                    service: method.parent,
                    method,
                    requestMethod: route.method,
                    url: apiBase,
                    header: new Headers(header),
                    contextValues: contextValues ?? createContextValues(),
                    message,
                },
                next: async (req) => {
                    const url = `${apiBase}${route.path(req.message)}`;
                    const headers = new Headers(req.header);
                    if (!headers.has("Content-Type"))
                        headers.set("Content-Type", "application/json");
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
