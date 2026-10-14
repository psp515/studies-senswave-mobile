import { Code } from "@connectrpc/connect";
import { Result, SimpleResult } from "@/utils/result";
import { toApiError, type ApiError } from "./errors";

export const ServerUnavailableText = "Server not available.";
const SomethingWentWrongText = "Something went wrong.";

export const isServerFailure = (err: ApiError): boolean =>
    err.code === Code.Unavailable ||
    err.code === Code.DeadlineExceeded ||
    err.code === Code.Internal ||
    err.code === Code.Unknown;

/** Result data tells the login screen whether to show the "resend confirmation email" button. */
export const loginFailure = (reason: unknown): Result<boolean> => {
    const err = toApiError(reason);

    if (err.code === Code.Unauthenticated) {
        // Identity SignInResult.ToString(): "NotAllowed" means the email is not confirmed yet.
        if (err.message === "NotAllowed") {
            return Result.failureWithData<boolean>("Please confirm your email.", true, err);
        }
        return Result.failureWithData<boolean>("Invalid email or password.", false, err);
    }

    if (isServerFailure(err)) {
        return Result.failureWithData<boolean>(ServerUnavailableText, false, err);
    }

    return Result.failureWithData<boolean>("Login failed unexpectedly.", false, err);
};

/** Identity validation problems (register, reset password): first useful description wins. */
export const identityValidationFailure = (reason: unknown, fallback: string): SimpleResult => {
    const err = toApiError(reason);

    if (err.code === Code.InvalidArgument) {
        const first = err.errors.find(
            (e) => e.code !== "DuplicateUserName" && e.description.trim(),
        );
        return SimpleResult.failure(first ? first.description : SomethingWentWrongText, err);
    }

    if (isServerFailure(err)) {
        return SimpleResult.failure(ServerUnavailableText, err);
    }

    return SimpleResult.failure(fallback, err);
};
