import { RpcError, RpcOptions, UnaryCall } from "@protobuf-ts/runtime-rpc";
import { ApiError, connectionApiError } from "@/api/apiError";
import { apiErrorFromRpcError } from "./grpcErrors";
import { classifyGrpcFailure, GrpcFailureKind } from "./status";

export const defaultGrpcTimeoutMs = 15000;

export type GrpcInvoke<O extends object> = (options: RpcOptions) => UnaryCall<any, O>;

export type GrpcOutcome<O> =
    | { isSuccess: true; response: O }
    | { isSuccess: false; kind: GrpcFailureKind; code: string; error: ApiError };

export interface GrpcCallDeps {
    isAuthenticated(): boolean;
    refresh(): Promise<string | null>;
    logout(): void;
    onSuccess(): void;
    onRefreshFailed(): void;
    onConsentMissing(error: ApiError): void;
}

const settle = async <O extends object>(
    invoke: GrpcInvoke<O>,
    options: RpcOptions,
): Promise<GrpcOutcome<O>> => {
    let call: UnaryCall<any, O> | undefined;

    try {
        call = invoke(options);
        const finished = await call;
        return { isSuccess: true, response: finished.response };
    } catch (e) {
        if (e instanceof RpcError) {
            return {
                isSuccess: false,
                kind: classifyGrpcFailure({
                    code: e.code,
                    // invoke itself may throw (for example UNIMPLEMENTED), leaving call undefined.
                    serviceTypeName: call?.method.service.typeName ?? e.serviceName ?? "",
                    methodName: call?.method.name ?? e.methodName ?? "",
                    detail: e.message,
                }),
                code: e.code,
                error: apiErrorFromRpcError(e),
            };
        }

        console.error("[gRPC] Call failed without a gRPC status", e);
        return {
            isSuccess: false,
            kind: "connectionError",
            code: "UNKNOWN",
            error: connectionApiError,
        };
    }
};

/** Runs a unary call with the same session behavior HttpClientProvider applies to REST calls. */
export const executeGrpcCall = async <O extends object>(
    deps: GrpcCallDeps,
    invoke: GrpcInvoke<O>,
): Promise<GrpcOutcome<O>> => {
    const finish = (outcome: GrpcOutcome<O>): GrpcOutcome<O> => {
        if (outcome.isSuccess) {
            deps.onSuccess();
        } else if (outcome.kind === "consentMissing") {
            // LegalConsentInterceptor refusal: same as REST LegalMiddleware 403.
            deps.logout();
            deps.onConsentMissing(outcome.error);
        }
        return outcome;
    };

    const first = await settle(invoke, { timeout: defaultGrpcTimeoutMs });

    if (first.isSuccess || first.kind !== "refreshAndRetry") {
        return finish(first);
    }

    if (!deps.isAuthenticated()) {
        deps.logout();
        return first;
    }

    const token = await deps.refresh();

    if (!token) {
        deps.onRefreshFailed();
        return first;
    }

    // The session state behind the auth interceptor updates on the next render, so pass the new token explicitly.
    const second = await settle(invoke, {
        timeout: defaultGrpcTimeoutMs,
        meta: { authorization: `Bearer ${token}` },
    });

    return finish(second);
};
