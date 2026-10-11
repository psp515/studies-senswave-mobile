import SenswaveGrpc from "../../../../modules/senswave-grpc";
import { NativeGrpcBridge } from "./nativeGrpcBridge";

export const nativeGrpcBridge = SenswaveGrpc as unknown as NativeGrpcBridge;
