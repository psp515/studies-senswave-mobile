import { Result, SimpleResult } from "@/utils/result";
import { toApiError } from "./errors";

const messageOf = (e: unknown, fallback: string) => {
    const err = toApiError(e);
    const text = err.firstDescription();
    return { err, text: text && text.trim() ? text : fallback };
};

/** Runs an api client call and folds the outcome into Result<T>. Never throws. */
export const call = async <T>(
    fn: () => Promise<T>,
    fallback = "Request failed.",
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
    fallback = "Request failed.",
): Promise<SimpleResult> => {
    try {
        await fn();
        return SimpleResult.success();
    } catch (e) {
        const { err, text } = messageOf(e, fallback);
        return SimpleResult.failure(text, err);
    }
};
