import { Code } from "@connectrpc/connect";
import type { ApiError } from "./errors";

export interface FailedResultLike {
    isSuccess: boolean;
    errorMessage: string | null;
    error?: ApiError;
}

export const DefaultErrorToastText = "An unexpected error occurred.";

/**
 * Codes the interceptor chain already handles: PermissionDenied -> logout + toast;
 * Unauthenticated -> refresh/logout path (toast only after repeated refresh failures).
 * Callers stay silent.
 */
const HandledCodes: ReadonlySet<Code> = new Set([Code.Unauthenticated, Code.PermissionDenied]);

export const toastTextFor = (
    result: FailedResultLike,
    fallback: string = DefaultErrorToastText,
): string | null => {
    if (result.isSuccess) return null;
    if (result.error && HandledCodes.has(result.error.code)) return null;
    const text = result.errorMessage?.trim();
    return text ? text : fallback;
};
