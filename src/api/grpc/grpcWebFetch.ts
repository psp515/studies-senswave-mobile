import { RpcError } from "@protobuf-ts/runtime-rpc";

const timeoutUnitsMs: Record<string, number> = {
    H: 3_600_000,
    M: 60_000,
    S: 1_000,
    m: 1,
    u: 1 / 1_000,
    n: 1 / 1_000_000,
};

const readHeader = (headers: HeadersInit | undefined, name: string): string | undefined => {
    if (!headers) {
        return undefined;
    }

    if (typeof (headers as Headers).get === "function") {
        return (headers as Headers).get(name) ?? undefined;
    }

    if (Array.isArray(headers)) {
        return headers.find(([key]) => key.toLowerCase() === name)?.[1];
    }

    const entry = Object.entries(headers as Record<string, string>).find(
        ([key]) => key.toLowerCase() === name,
    );

    return entry?.[1];
};

/** Parses a grpc-timeout header value ("15000m", "2S", ...) into milliseconds. */
const parseGrpcTimeoutMs = (value: string | undefined): number | undefined => {
    const match = value ? /^(\d+)([HMSmun])$/.exec(value) : null;

    if (!match) {
        return undefined;
    }

    return Math.max(1, Math.ceil(Number(match[1]) * timeoutUnitsMs[match[2]]));
};

/**
 * Wraps fetch so GrpcWebFetchTransport behaves like the native transport:
 * - enforces the client deadline (grpc-timeout header) until response headers arrive -> DEADLINE_EXCEEDED
 * - maps transport failures (offline, DNS, TLS) to UNAVAILABLE instead of INTERNAL
 * - lets a caller abort propagate untouched (mapped to CANCELLED by the transport)
 * Streams carry no grpc-timeout header, so they get no timer.
 */
export const createGrpcWebFetch =
    (baseFetch: typeof fetch): typeof fetch =>
    (input, init) => {
        const callerSignal = init?.signal ?? undefined;
        const timeoutMs = parseGrpcTimeoutMs(readHeader(init?.headers, "grpc-timeout"));

        const toRpcError = (reason: unknown): unknown => {
            if (callerSignal?.aborted || reason instanceof RpcError) {
                return reason;
            }

            return new RpcError(
                reason instanceof Error ? reason.message : `${reason}`,
                "UNAVAILABLE",
            );
        };

        if (timeoutMs === undefined) {
            return baseFetch(input, init).catch((reason) => {
                throw toRpcError(reason);
            });
        }

        const controller = new AbortController();
        const abortFromCaller = () => controller.abort();
        callerSignal?.addEventListener("abort", abortFromCaller);
        if (callerSignal?.aborted) {
            controller.abort();
        }

        return new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(() => {
                controller.abort();
                reject(new RpcError("Deadline exceeded", "DEADLINE_EXCEEDED"));
            }, timeoutMs);

            const cleanup = () => {
                clearTimeout(timer);
                callerSignal?.removeEventListener("abort", abortFromCaller);
            };

            baseFetch(input, { ...init, signal: controller.signal }).then(
                (response) => {
                    cleanup();
                    resolve(response);
                },
                (reason) => {
                    cleanup();
                    reject(toRpcError(reason));
                },
            );
        });
    };
