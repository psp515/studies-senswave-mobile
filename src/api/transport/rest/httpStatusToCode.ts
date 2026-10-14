import { Code } from "@connectrpc/connect";

export const httpStatusToCode = (status: number): Code => {
    switch (status) {
        case 400:
        case 422:
            return Code.InvalidArgument;
        case 401:
            return Code.Unauthenticated;
        case 403:
            return Code.PermissionDenied;
        case 404:
            return Code.NotFound;
        case 408:
        case 504:
            return Code.DeadlineExceeded;
        case 409:
            return Code.AlreadyExists;
        case 429:
            return Code.ResourceExhausted;
        case 501:
            return Code.Unimplemented;
        case 503:
            return Code.Unavailable;
        default:
            return status >= 500 ? Code.Internal : Code.Unknown;
    }
};
