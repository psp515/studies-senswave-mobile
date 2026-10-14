import type { ApiError } from "@/api/errors";

export class SimpleResult {
    isSuccess: boolean;
    errorMessage: string | null;
    error?: ApiError;

    constructor(isSuccess: boolean, errorMessage: string | null = null, error?: ApiError) {
        this.isSuccess = isSuccess;
        this.errorMessage = errorMessage;
        this.error = error;
    }

    static success(): SimpleResult {
        return new SimpleResult(true, null);
    }

    static failure(errorMessage: string, error?: ApiError): SimpleResult {
        return new SimpleResult(false, errorMessage, error);
    }
}

export class Result<T = any> {
    data: T | null;
    isSuccess: boolean;
    errorMessage: string | null;
    error?: ApiError;

    constructor(
        isSuccess: boolean,
        data: T | null = null,
        errorMessage: string | null = null,
        error?: ApiError,
    ) {
        this.isSuccess = isSuccess;
        this.data = data;
        this.errorMessage = errorMessage;
        this.error = error;
    }

    static success<T>(data: T): Result<T> {
        return new Result<T>(true, data, null);
    }

    static failure<T>(errorMessage: string, error?: ApiError): Result<T> {
        return new Result<T>(false, null, errorMessage, error);
    }

    static failureWithData<T>(errorMessage: string, data: T, error?: ApiError): Result<T> {
        return new Result<T>(false, data, errorMessage, error);
    }
}
