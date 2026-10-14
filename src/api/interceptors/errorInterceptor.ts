import type { Interceptor } from "@connectrpc/connect";
import { toApiError } from "@/api/errors";

/** Innermost interceptor: every failure leaving the chain is an ApiError. */
export const createErrorInterceptor = (): Interceptor => (next) => async (req) => {
    try {
        return await next(req);
    } catch (e) {
        throw toApiError(e);
    }
};
