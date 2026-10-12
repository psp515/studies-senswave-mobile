import { NativeGrpcBridge } from "./nativeGrpcBridge";

let bridge: NativeGrpcBridge | undefined;

/**
 * Loads the native module on first use only. The module calls requireNativeModule at import
 * time, so it must never be imported on the Rest/GrpcWeb paths (older dev clients, Expo Go, iOS).
 */
export const getNativeGrpcBridge = (): NativeGrpcBridge => {
    if (!bridge) {
        bridge = require("../../../../modules/senswave-grpc").default as NativeGrpcBridge;
    }
    return bridge;
};
