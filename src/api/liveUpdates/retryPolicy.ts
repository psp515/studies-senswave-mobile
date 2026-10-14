import { Code, ConnectError } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";

const SlowRetryMs = 15000;
const FastRetryBaseMs = 1000;
const FastRetryJitterMs = 1000;

const codeOf = (e: unknown): Code => (ApiError.is(e) ? e.code : ConnectError.from(e).code);

/** Errors a resubscribe cannot fix (revoked share, server lacks the RPC, bad request). */
export const isTerminalLiveUpdateError = (err: unknown): boolean => {
    const code = codeOf(err);
    return (
        code === Code.PermissionDenied ||
        code === Code.Unimplemented ||
        code === Code.InvalidArgument
    );
};

/**
 * Delay before resubscribing, or null when the error is terminal. A stream that had reached
 * `initialized` and then dropped with Unavailable or DeadlineExceeded reconnects fast (1 s + up to 1 s jitter).
 */
export const nextRetryDelayMs = (
    err: unknown,
    hadInitialized: boolean,
    random: () => number = Math.random,
): number | null => {
    if (isTerminalLiveUpdateError(err)) return null;
    const code = codeOf(err);
    if (hadInitialized && (code === Code.Unavailable || code === Code.DeadlineExceeded)) {
        return FastRetryBaseMs + Math.floor(random() * FastRetryJitterMs);
    }
    return SlowRetryMs;
};
