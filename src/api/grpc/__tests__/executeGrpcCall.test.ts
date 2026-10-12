import { RpcError, RpcOptions, UnaryCall } from "@protobuf-ts/runtime-rpc";
import { executeGrpcCall, GrpcCallDeps } from "@/api/grpc/executeGrpcCall";

type Result = { response: object } | { error: unknown };

const fakeCall = (typeName: string, name: string, result: Result) => {
    const promise =
        "error" in result
            ? Promise.reject(result.error)
            : Promise.resolve({ response: result.response });
    promise.catch(() => {});
    return Object.assign(promise, {
        method: { name, service: { typeName } },
    }) as unknown as UnaryCall<any, object>;
};

const makeDeps = (overrides: Partial<GrpcCallDeps> = {}): jest.Mocked<GrpcCallDeps> =>
    ({
        isAuthenticated: jest.fn().mockReturnValue(true),
        refresh: jest.fn().mockResolvedValue("fresh-token"),
        logout: jest.fn(),
        onSuccess: jest.fn(),
        onRefreshFailed: jest.fn(),
        onConsentMissing: jest.fn(),
        ...overrides,
    }) as jest.Mocked<GrpcCallDeps>;

const devices = "senswave.devices.v1.DevicesService";

describe("executeGrpcCall", () => {
    it("returns the response and passes the default deadline", async () => {
        const deps = makeDeps();
        const invoke = jest.fn((_: RpcOptions) =>
            fakeCall(devices, "GetDevice", { response: { id: "d1" } }),
        );

        const outcome = await executeGrpcCall(deps, invoke);

        expect(outcome).toEqual({ isSuccess: true, response: { id: "d1" } });
        expect(invoke).toHaveBeenCalledWith({ timeout: 15000 });
        expect(deps.onSuccess).toHaveBeenCalled();
    });

    it("refreshes once and retries with the new token on UNAUTHENTICATED", async () => {
        const deps = makeDeps();
        const invoke = jest
            .fn()
            .mockReturnValueOnce(
                fakeCall(devices, "GetDevice", {
                    error: new RpcError("expired", "UNAUTHENTICATED"),
                }),
            )
            .mockReturnValueOnce(fakeCall(devices, "GetDevice", { response: { id: "d1" } }));

        const outcome = await executeGrpcCall(deps, invoke);

        expect(outcome.isSuccess).toBe(true);
        expect(deps.refresh).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenLastCalledWith({
            timeout: 15000,
            meta: { authorization: "Bearer fresh-token" },
        });
    });

    it("reports a failed refresh without retrying", async () => {
        const deps = makeDeps({ refresh: jest.fn().mockResolvedValue(null) });
        const invoke = jest.fn(() =>
            fakeCall(devices, "GetDevice", { error: new RpcError("expired", "UNAUTHENTICATED") }),
        );

        const outcome = await executeGrpcCall(deps, invoke);

        expect(outcome).toMatchObject({
            isSuccess: false,
            kind: "refreshAndRetry",
            code: "UNAUTHENTICATED",
        });
        expect(deps.onRefreshFailed).toHaveBeenCalled();
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("logs out instead of refreshing when the session is not authenticated", async () => {
        const deps = makeDeps({ isAuthenticated: jest.fn().mockReturnValue(false) });
        const invoke = jest.fn(() =>
            fakeCall(devices, "GetDevice", { error: new RpcError("no token", "UNAUTHENTICATED") }),
        );

        await executeGrpcCall(deps, invoke);

        expect(deps.logout).toHaveBeenCalled();
        expect(deps.refresh).not.toHaveBeenCalled();
    });

    it("logs out and reports on missing consents", async () => {
        const deps = makeDeps();
        const invoke = jest.fn(() =>
            fakeCall(devices, "GetDevice", {
                error: new RpcError("User does not have latest consents.", "PERMISSION_DENIED"),
            }),
        );

        const outcome = await executeGrpcCall(deps, invoke);

        expect(outcome).toMatchObject({ isSuccess: false, kind: "consentMissing" });
        expect(deps.logout).toHaveBeenCalled();
        expect(deps.onConsentMissing).toHaveBeenCalledWith(
            expect.objectContaining({ statusText: "User does not have latest consents." }),
        );
    });

    it("applies consent handling to the retried call too", async () => {
        const deps = makeDeps();
        const invoke = jest
            .fn()
            .mockReturnValueOnce(
                fakeCall(devices, "GetDevice", {
                    error: new RpcError("expired", "UNAUTHENTICATED"),
                }),
            )
            .mockReturnValueOnce(
                fakeCall(devices, "GetDevice", {
                    error: new RpcError("consents", "PERMISSION_DENIED"),
                }),
            );

        await executeGrpcCall(deps, invoke);

        expect(deps.logout).toHaveBeenCalled();
    });

    it("classifies login failures without refreshing", async () => {
        const deps = makeDeps();
        const invoke = jest.fn(() =>
            fakeCall("senswave.users.v1.AuthService", "Login", {
                error: new RpcError("NotAllowed", "UNAUTHENTICATED"),
            }),
        );

        const outcome = await executeGrpcCall(deps, invoke);

        expect(outcome).toMatchObject({ isSuccess: false, kind: "emailNotConfirmed" });
        expect(deps.refresh).not.toHaveBeenCalled();
    });

    it("maps a non-RpcError to a connection error", async () => {
        const deps = makeDeps();
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        const invoke = jest.fn(() =>
            fakeCall(devices, "GetDevice", { error: new TypeError("Network request failed") }),
        );

        const outcome = await executeGrpcCall(deps, invoke);

        expect(outcome).toMatchObject({
            isSuccess: false,
            kind: "connectionError",
            code: "UNKNOWN",
        });
        error.mockRestore();
    });
});
