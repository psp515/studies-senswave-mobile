import { base64decode, base64encode } from "@protobuf-ts/runtime";
import {
    ClientStreamingCall,
    Deferred,
    DuplexStreamingCall,
    mergeRpcOptions,
    MethodInfo,
    RpcError,
    RpcInterceptor,
    RpcMetadata,
    RpcOptions,
    RpcOutputStreamController,
    RpcStatus,
    RpcTransport,
    ServerStreamingCall,
    UnaryCall,
} from "@protobuf-ts/runtime-rpc";
import { GrpcStatusCode } from "@protobuf-ts/grpcweb-transport";
import {
    NativeCallResult,
    NativeGrpcBridge,
    NativeMetadata,
    NativeSubscription,
} from "./nativeGrpcBridge";

export interface NativeGrpcTransportOptions {
    bridge: NativeGrpcBridge;
    /** API origin, for example "https://localhost:7070". Read per call so URL overrides apply. */
    getBaseUrl: () => string;
    interceptors?: RpcInterceptor[];
}

let callCounter = 0;
const nextCallId = () => `grpc-${Date.now()}-${++callCounter}`;

const toNativeMetadata = (meta: RpcMetadata | undefined): NativeMetadata =>
    Object.fromEntries(
        Object.entries(meta ?? {}).map(([key, value]) => [
            key.toLowerCase(),
            Array.isArray(value) ? value : [value],
        ]),
    );

const fromNativeMetadata = (meta: NativeMetadata): RpcMetadata =>
    Object.fromEntries(
        Object.entries(meta).map(([key, values]) => [
            key,
            values.length === 1 ? values[0] : values,
        ]),
    );

const deadlineMs = (timeout: RpcOptions["timeout"]): number => {
    if (timeout === undefined) return 0;
    if (typeof timeout === "number") return timeout;
    return Math.max(1, timeout.getTime() - Date.now());
};

const statusName = (code: number): string => GrpcStatusCode[code] ?? "UNKNOWN";

const methodPath = (method: MethodInfo) => `${method.service.typeName}/${method.name}`;

const localError = (method: MethodInfo, message: string, code: string): RpcError => {
    const error = new RpcError(message, code);
    error.serviceName = method.service.typeName;
    error.methodName = method.name;
    return error;
};

const rpcError = (method: MethodInfo, result: NativeCallResult): RpcError => {
    const error = new RpcError(
        result.message,
        statusName(result.status),
        fromNativeMetadata(result.trailers),
    );
    error.serviceName = method.service.typeName;
    error.methodName = method.name;
    return error;
};

/** protobuf-ts RpcTransport over modules/senswave-grpc (native gRPC, HTTP/2, Android). */
export class NativeGrpcTransport implements RpcTransport {
    private readonly defaultOptions: RpcOptions;

    constructor(private readonly options: NativeGrpcTransportOptions) {
        this.defaultOptions = { interceptors: options.interceptors };
    }

    mergeOptions(options?: Partial<RpcOptions>): RpcOptions {
        return mergeRpcOptions(this.defaultOptions, options);
    }

    unary<I extends object, O extends object>(
        method: MethodInfo<I, O>,
        input: I,
        options: RpcOptions,
    ): UnaryCall<I, O> {
        const callId = nextCallId();
        const requestMeta = options.meta ?? {};
        const headers = new Deferred<RpcMetadata>();
        const response = new Deferred<O>();
        const status = new Deferred<RpcStatus>();
        const trailers = new Deferred<RpcMetadata>();

        const fail = (error: RpcError) => {
            headers.rejectPending(error);
            response.rejectPending(error);
            status.rejectPending(error);
            trailers.rejectPending(error);
        };

        if (options.abort?.aborted) {
            fail(localError(method, "Call was cancelled before it started.", "CANCELLED"));
            return new UnaryCall<I, O>(
                method,
                requestMeta,
                input,
                headers.promise,
                response.promise,
                status.promise,
                trailers.promise,
            );
        }

        options.abort?.addEventListener("abort", () => this.options.bridge.cancel(callId));

        this.options.bridge
            .unary(
                callId,
                this.options.getBaseUrl(),
                methodPath(method),
                base64encode(method.I.toBinary(input, options.binaryOptions)),
                toNativeMetadata(requestMeta),
                deadlineMs(options.timeout),
            )
            .then(
                (result) => {
                    headers.resolvePending(fromNativeMetadata(result.headers));

                    if (result.status !== GrpcStatusCode.OK || result.responseBase64 === null) {
                        fail(rpcError(method, result));
                        return;
                    }

                    let decoded: O;
                    try {
                        decoded = method.O.fromBinary(
                            base64decode(result.responseBase64),
                            options.binaryOptions,
                        );
                    } catch (reason) {
                        fail(
                            localError(
                                method,
                                `Failed to decode response: ${String(reason)}`,
                                "INTERNAL",
                            ),
                        );
                        return;
                    }

                    response.resolvePending(decoded);
                    status.resolvePending({ code: "OK", detail: result.message });
                    trailers.resolvePending(fromNativeMetadata(result.trailers));
                },
                (reason) => {
                    const error = new RpcError(String(reason), "UNAVAILABLE");
                    error.serviceName = method.service.typeName;
                    error.methodName = method.name;
                    fail(error);
                },
            );

        return new UnaryCall<I, O>(
            method,
            requestMeta,
            input,
            headers.promise,
            response.promise,
            status.promise,
            trailers.promise,
        );
    }

    serverStreaming<I extends object, O extends object>(
        method: MethodInfo<I, O>,
        input: I,
        options: RpcOptions,
    ): ServerStreamingCall<I, O> {
        const callId = nextCallId();
        const requestMeta = options.meta ?? {};
        const bridge = this.options.bridge;
        const headers = new Deferred<RpcMetadata>();
        const responses = new RpcOutputStreamController<O>();
        const status = new Deferred<RpcStatus>();
        const trailers = new Deferred<RpcMetadata>();

        if (options.abort?.aborted) {
            const error = localError(method, "Call was cancelled before it started.", "CANCELLED");
            headers.rejectPending(error);
            responses.notifyError(error);
            status.rejectPending(error);
            trailers.rejectPending(error);
            return new ServerStreamingCall<I, O>(
                method,
                requestMeta,
                input,
                headers.promise,
                responses,
                status.promise,
                trailers.promise,
            );
        }

        const subscriptions: NativeSubscription[] = [
            bridge.addListener("onStreamHeaders", (event) => {
                if (event.callId === callId)
                    headers.resolvePending(fromNativeMetadata(event.headers));
            }),
            bridge.addListener("onStreamMessage", (event) => {
                if (event.callId !== callId) return;
                let message: O;
                try {
                    message = method.O.fromBinary(
                        base64decode(event.base64),
                        options.binaryOptions,
                    );
                } catch (reason) {
                    subscriptions.forEach((s) => s.remove());
                    bridge.cancel(callId);
                    const error = localError(
                        method,
                        `Failed to decode stream message: ${String(reason)}`,
                        "INTERNAL",
                    );
                    headers.rejectPending(error);
                    responses.notifyError(error);
                    status.rejectPending(error);
                    trailers.rejectPending(error);
                    return;
                }
                responses.notifyMessage(message);
            }),
            bridge.addListener("onStreamClose", (event) => {
                if (event.callId !== callId) return;
                subscriptions.forEach((s) => s.remove());
                headers.resolvePending(fromNativeMetadata(event.headers));

                if (event.status === GrpcStatusCode.OK) {
                    responses.notifyComplete();
                    status.resolvePending({ code: "OK", detail: event.message });
                    trailers.resolvePending(fromNativeMetadata(event.trailers));
                    return;
                }

                const error = rpcError(method, event);
                responses.notifyError(error);
                status.rejectPending(error);
                trailers.rejectPending(error);
            }),
        ];

        options.abort?.addEventListener("abort", () => bridge.cancel(callId));

        bridge.startServerStream(
            callId,
            this.options.getBaseUrl(),
            methodPath(method),
            base64encode(method.I.toBinary(input, options.binaryOptions)),
            toNativeMetadata(requestMeta),
            deadlineMs(options.timeout),
        );

        return new ServerStreamingCall<I, O>(
            method,
            requestMeta,
            input,
            headers.promise,
            responses,
            status.promise,
            trailers.promise,
        );
    }

    clientStreaming<I extends object, O extends object>(
        method: MethodInfo<I, O>,
    ): ClientStreamingCall<I, O> {
        throw new RpcError(
            `Client streaming is not supported (${methodPath(method)}).`,
            "UNIMPLEMENTED",
        );
    }

    duplex<I extends object, O extends object>(
        method: MethodInfo<I, O>,
    ): DuplexStreamingCall<I, O> {
        throw new RpcError(
            `Duplex streaming is not supported (${methodPath(method)}).`,
            "UNIMPLEMENTED",
        );
    }
}
