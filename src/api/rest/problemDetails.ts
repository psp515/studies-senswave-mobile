import { ApiError } from "@/api/apiError";

interface ProblemDetailsBody {
    title?: string;
    errors?: unknown;
    traceId?: string;
}

interface ProblemDetailsError {
    code?: string;
    description?: string;
}

export const apiErrorFromProblemDetails = (text: string): ApiError | null => {
    let body: ProblemDetailsBody;

    try {
        body = JSON.parse(text);
    } catch {
        return null;
    }

    if (!body || typeof body !== "object") {
        return null;
    }

    const errors = Array.isArray(body.errors)
        ? (body.errors as unknown[]).filter(
              (e): e is ProblemDetailsError => !!e && typeof e === "object",
          )
        : [];

    return {
        statusText: body.title ?? "",
        errors: errors.map((e) => ({ code: e.code ?? "", description: e.description ?? "" })),
        traceId: body.traceId,
    };
};
