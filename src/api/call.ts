import { Code } from "@connectrpc/connect";
import { Result, SimpleResult } from "@/utils/result";
import { toApiError, type ApiError } from "./errors";
import { DefaultErrorToastText } from "./toastDecision";

export const ConnectionErrorMessage = "Connection error. Please check your internet connection.";

/**
 * User-facing text: the first backend error description, else a connection message for
 * Unavailable / DeadlineExceeded, else the caller fallback. ApiError.message (problem title or
 * transport text) is never shown to users, only logged.
 */
const messageOf = (e: unknown, fallback: string): { err: ApiError; text: string } => {
    const err = toApiError(e);
    console.debug(`[Api] Call failed (${Code[err.code]}): ${err.message}`);

    const description = err.errors[0]?.description?.trim();
    if (description) return { err, text: description };
    if (err.code === Code.Unavailable || err.code === Code.DeadlineExceeded) {
        return { err, text: ConnectionErrorMessage };
    }
    return { err, text: fallback };
};

/** Runs an api client call and folds the outcome into Result<T>. Never throws. */
export const call = async <T>(
    fn: () => Promise<T>,
    fallback = DefaultErrorToastText,
): Promise<Result<T>> => {
    try {
        return Result.success<T>(await fn());
    } catch (e) {
        const { err, text } = messageOf(e, fallback);
        return Result.failure<T>(text, err);
    }
};

export const callSimple = async (
    fn: () => Promise<unknown>,
    fallback = DefaultErrorToastText,
): Promise<SimpleResult> => {
    try {
        await fn();
        return SimpleResult.success();
    } catch (e) {
        const { err, text } = messageOf(e, fallback);
        return SimpleResult.failure(text, err);
    }
};

/** True when a failed result carries a NotFound code. */
export const isNotFound = (result: { error?: ApiError }): boolean =>
    result.error?.code === Code.NotFound;

/** True when an error (or a failed result's error) carries a PermissionDenied code. */
export const isPermissionDenied = (e: ApiError | { error?: ApiError } | undefined): boolean => {
    if (!e) return false;
    const err = "code" in e ? e : e.error;
    return err?.code === Code.PermissionDenied;
};
