/** Metadata as sent over the bridge: lowercase keys, every value a list; "-bin" values are base64. */
export type NativeMetadata = Record<string, string[]>;

export interface NativeCallResult {
    /** Numeric gRPC status code (0 = OK). */
    status: number;
    message: string;
    headers: NativeMetadata;
    trailers: NativeMetadata;
}

export interface NativeUnaryResult extends NativeCallResult {
    responseBase64: string | null;
}

export interface NativeStreamHeadersEvent {
    callId: string;
    headers: NativeMetadata;
}

export interface NativeStreamMessageEvent {
    callId: string;
    base64: string;
}

export interface NativeStreamCloseEvent extends NativeCallResult {
    callId: string;
}

export interface NativeSubscription {
    remove(): void;
}

/** Surface of modules/senswave-grpc. `method` is "<package>.<Service>/<Method>". */
export interface NativeGrpcBridge {
    unary(
        callId: string,
        baseUrl: string,
        method: string,
        requestBase64: string,
        metadata: NativeMetadata,
        deadlineMs: number,
    ): Promise<NativeUnaryResult>;
    startServerStream(
        callId: string,
        baseUrl: string,
        method: string,
        requestBase64: string,
        metadata: NativeMetadata,
        deadlineMs: number,
    ): void;
    cancel(callId: string): void;
    addListener(
        event: "onStreamHeaders",
        listener: (event: NativeStreamHeadersEvent) => void,
    ): NativeSubscription;
    addListener(
        event: "onStreamMessage",
        listener: (event: NativeStreamMessageEvent) => void,
    ): NativeSubscription;
    addListener(
        event: "onStreamClose",
        listener: (event: NativeStreamCloseEvent) => void,
    ): NativeSubscription;
}
