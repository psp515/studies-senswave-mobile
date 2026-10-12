import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { MethodInfo, RpcInterceptor, RpcOptions, RpcTransport } from "@protobuf-ts/runtime-rpc";
import { fetch as expoFetch } from "expo/fetch";
import { TransportMode } from "@/config/transport";
import { isAnonymousService } from "./status";
import { createGrpcWebFetch } from "./grpcWebFetch";
import { NativeGrpcTransport } from "./native/NativeGrpcTransport";
import { NativeGrpcBridge } from "./native/nativeGrpcBridge";

export interface GrpcTransportDeps {
    getBaseUrl: () => URL;
    getAccessToken: () => string | undefined;
    getBridge: () => NativeGrpcBridge;
}

export const withAuthorization = (
    method: MethodInfo,
    options: RpcOptions,
    token: string | undefined,
): RpcOptions => {
    if (!token || isAnonymousService(method.service.typeName) || options.meta?.authorization) {
        return options;
    }

    return { ...options, meta: { ...options.meta, authorization: `Bearer ${token}` } };
};

export const createAuthInterceptor = (
    getAccessToken: () => string | undefined,
): RpcInterceptor => ({
    interceptUnary: (next, method, input, options) =>
        next(method, input, withAuthorization(method, options, getAccessToken())),
    interceptServerStreaming: (next, method, input, options) =>
        next(method, input, withAuthorization(method, options, getAccessToken())),
});

export const createGrpcTransport = (
    mode: Exclude<TransportMode, "Rest">,
    deps: GrpcTransportDeps,
): RpcTransport => {
    const interceptors = [createAuthInterceptor(deps.getAccessToken)];

    if (mode === "GrpcWeb") {
        // expo/fetch streams response bodies on Android; React Native's fetch buffers them,
        // which would break LiveUpdatesService.Subscribe.
        return new GrpcWebFetchTransport({
            baseUrl: deps.getBaseUrl().origin,
            format: "binary",
            fetch: createGrpcWebFetch(expoFetch as unknown as typeof fetch),
            interceptors,
        });
    }

    return new NativeGrpcTransport({
        bridge: deps.getBridge(),
        getBaseUrl: () => deps.getBaseUrl().origin,
        interceptors,
    });
};
