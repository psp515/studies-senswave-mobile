import { Code, ConnectError } from "@connectrpc/connect";
import { create, fromBinary } from "@bufbuild/protobuf";
import { Error as SenswaveError, ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";

export type { SenswaveError };

export const ErrorsTrailerKey = "senswave-errors-bin";
export const TraceIdTrailerKey = "senswave-trace-id";

/** Attached as `cause` of a ConnectError by the REST transport. */
export interface RestProblem {
    httpStatus: number;
    body: unknown;
}

export const isRestProblem = (v: unknown): v is RestProblem =>
    typeof v === "object" && v !== null && "httpStatus" in v && "body" in v;

export class ApiError extends Error {
    readonly code: Code;
    readonly httpStatus?: number;
    readonly errors: SenswaveError[];
    readonly traceId?: string;

    constructor(args: {
        code: Code;
        message: string;
        httpStatus?: number;
        errors?: SenswaveError[];
        traceId?: string;
        cause?: unknown;
    }) {
        super(args.message);
        // lib target predates ErrorOptions, so assign cause manually
        (this as { cause?: unknown }).cause = args.cause;
        this.name = "ApiError";
        this.code = args.code;
        this.httpStatus = args.httpStatus;
        this.errors = args.errors ?? [];
        this.traceId = args.traceId;
    }

    static is(e: unknown): e is ApiError {
        return e instanceof ApiError;
    }

    hasErrorCode(code: string): boolean {
        return this.errors.some((e) => e.code === code);
    }

    firstDescription(): string {
        const first = this.errors[0];
        if (!first) return this.message;
        return first.description || first.code;
    }
}

const errorTypeFromNumber = (n: unknown): ErrorType => {
    if (typeof n === "number" && n >= 0 && n <= 5) return n as ErrorType;
    return ErrorType.UNSPECIFIED;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
    typeof v === "object" && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;

/**
 * Accepts both Senswave `ErrorProblemDetails` (errors: Error[]) and ASP.NET Identity
 * `ValidationProblemDetails` (errors: { [code]: string[] }).
 */
export const restProblemToErrors = (
    json: unknown,
): { errors: SenswaveError[]; traceId?: string; message?: string } => {
    const body = asRecord(json);
    if (!body) return { errors: [] };

    const errors: SenswaveError[] = [];
    const raw = body.errors;

    if (Array.isArray(raw)) {
        for (const item of raw) {
            const r = asRecord(item);
            if (!r) continue;
            errors.push(
                create(ErrorSchema, {
                    code: typeof r.code === "string" ? r.code : "",
                    type: errorTypeFromNumber(r.type),
                    description: typeof r.description === "string" ? r.description : "",
                }),
            );
        }
    } else {
        const map = asRecord(raw);
        if (map) {
            for (const [code, messages] of Object.entries(map)) {
                const description =
                    Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : "";
                errors.push(create(ErrorSchema, { code, type: ErrorType.VALIDATION, description }));
            }
        }
    }

    const traceId = typeof body.traceId === "string" ? body.traceId : undefined;
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    const title = typeof body.title === "string" ? body.title : undefined;

    return { errors, traceId, message: detail ?? title };
};

const base64ToBytes = (b64: string): Uint8Array => {
    // atob exists in Hermes and Node >= 16
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
};

const errorsFromTrailers = (metadata: Headers): { errors: SenswaveError[]; traceId?: string } => {
    const errors: SenswaveError[] = [];
    // Headers joins repeated values with ", " - split them back.
    const joined = metadata.get(ErrorsTrailerKey);
    if (joined) {
        for (const part of joined.split(",")) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            try {
                errors.push(fromBinary(ErrorSchema, base64ToBytes(trimmed)));
            } catch (e) {
                console.warn("[ApiError] Failed to decode senswave-errors-bin entry", e);
            }
        }
    }
    return { errors, traceId: metadata.get(TraceIdTrailerKey) ?? undefined };
};

export const toApiError = (reason: unknown): ApiError => {
    if (ApiError.is(reason)) return reason;

    const ce = ConnectError.from(reason);

    if (isRestProblem(ce.cause)) {
        const parsed = restProblemToErrors(ce.cause.body);
        return new ApiError({
            code: ce.code,
            message: parsed.message ?? ce.rawMessage,
            httpStatus: ce.cause.httpStatus,
            errors: parsed.errors,
            traceId: parsed.traceId,
            cause: ce,
        });
    }

    const fromTrailers = errorsFromTrailers(ce.metadata);
    return new ApiError({
        code: ce.code,
        message: ce.rawMessage,
        errors: fromTrailers.errors,
        traceId: fromTrailers.traceId,
        cause: ce,
    });
};
