export interface ApiErrorDetail {
    code: string;
    description: string;
}

/** Transport-neutral error: built from a REST ProblemDetails body or from gRPC status and trailers. */
export interface ApiError {
    statusText: string;
    errors: ApiErrorDetail[];
    traceId?: string;
}

export const connectionApiError: ApiError = {
    statusText: "Connection error. Please check your internet connection.",
    errors: [],
};

export const apiErrorMessage = (error: ApiError): string => {
    const first = error.errors[0];

    if (first) {
        return first.description ? first.description : first.code;
    }

    return "An unexpected error occurred.";
};
