import { base64decode } from "@protobuf-ts/runtime";
import { RpcError, RpcMetadata } from "@protobuf-ts/runtime-rpc";
import { Error as ProtoError } from "@/generated/common/v1/common";
import { ApiError, ApiErrorDetail } from "@/api/apiError";

export const errorsTrailerKey = "senswave-errors-bin";
export const traceIdTrailerKey = "senswave-trace-id";

// A repeated trailer arrives as an array (native) or as one comma-joined string (gRPC-Web).
// Base64 never contains commas, so splitting is safe.
const metadataValues = (meta: RpcMetadata, key: string): string[] => {
    const value = meta[key];

    if (value === undefined) {
        return [];
    }

    const list = Array.isArray(value) ? value : [value];

    return list
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter((v) => v !== "");
};

export const decodeErrorTrailers = (meta: RpcMetadata): ApiErrorDetail[] =>
    metadataValues(meta, errorsTrailerKey).flatMap((value) => {
        try {
            const error = ProtoError.fromBinary(base64decode(value));
            return [{ code: error.code, description: error.description }];
        } catch (e) {
            console.warn(`[gRPC] Failed to decode ${errorsTrailerKey} entry`, e);
            return [];
        }
    });

export const apiErrorFromRpcError = (error: RpcError): ApiError => ({
    statusText: error.message,
    errors: decodeErrorTrailers(error.meta ?? {}),
    traceId: metadataValues(error.meta ?? {}, traceIdTrailerKey)[0],
});
