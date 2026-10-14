import { Code, ConnectError, type UnaryRequest, type UnaryResponse } from "@connectrpc/connect";
import { createContextValues } from "@connectrpc/connect";
import { createAsyncIterable } from "@connectrpc/connect/protocol";
import type { DescMethod, DescService } from "@bufbuild/protobuf";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { ApiError } from "@/api/errors";
import { createAuthInterceptor } from "@/api/interceptors/authInterceptor";

const unaryReq = (
    service: DescService = UsersService,
    method: DescMethod = UsersService.method.getUser,
): UnaryRequest =>
    ({
        stream: false,
        service,
        method,
        url: "https://h/api/",
        signal: new AbortController().signal,
        header: new Headers(),
        contextValues: createContextValues(),
        message: {},
        requestMethod: "GET",
    }) as unknown as UnaryRequest;

const okRes = (): UnaryResponse =>
    ({
        stream: false,
        service: UsersService,
        method: UsersService.method.getUser,
        header: new Headers(),
        message: {},
        trailer: new Headers(),
    }) as unknown as UnaryResponse;

describe("authInterceptor", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("adds bearer header", async () => {
        let seen: string | null = null;
        const i = createAuthInterceptor({
            getAccessToken: () => "tok",
            refresh: async () => null,
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        await i(async (req) => {
            seen = req.header.get("Authorization");
            return okRes();
        })(unaryReq());
        expect(seen).toBe("Bearer tok");
    });

    it("skips anonymous services", async () => {
        let seen: string | null = "x";
        const i = createAuthInterceptor({
            getAccessToken: () => "tok",
            refresh: async () => null,
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        await i(async (req) => {
            seen = req.header.get("Authorization");
            return okRes();
        })(unaryReq(AuthService, AuthService.method.login));
        expect(seen).toBeNull();
    });

    it("logs out and throws Unauthenticated when no token", async () => {
        const logout = jest.fn();
        const i = createAuthInterceptor({
            getAccessToken: () => null,
            refresh: async () => null,
            logout,
            onRefreshFailed: jest.fn(),
        });
        const err = await i(async () => okRes())(unaryReq()).catch((e) => e);
        expect(ApiError.is(err)).toBe(true);
        expect((err as ApiError).code).toBe(Code.Unauthenticated);
        expect(logout).toHaveBeenCalled();
    });

    it("refreshes once and retries with new token", async () => {
        const tokens: string[] = [];
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => "new",
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const res = await i(async (req) => {
            const t = req.header.get("Authorization")!;
            tokens.push(t);
            if (t === "Bearer old") throw new ConnectError("401", Code.Unauthenticated);
            return okRes();
        })(unaryReq());
        expect(res).toBeTruthy();
        expect(tokens).toEqual(["Bearer old", "Bearer new"]);
    });

    it("does not retry twice", async () => {
        let calls = 0;
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => "new",
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const err = await i(async () => {
            calls++;
            throw new ConnectError("401", Code.Unauthenticated);
        })(unaryReq()).catch((e) => e);
        expect(calls).toBe(2);
        expect((err as ConnectError).code).toBe(Code.Unauthenticated);
    });

    it("reports failed refresh and rethrows", async () => {
        const onRefreshFailed = jest.fn();
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => null,
            logout: jest.fn(),
            onRefreshFailed,
        });
        const err = await i(async () => {
            throw new ConnectError("401", Code.Unauthenticated);
        })(unaryReq()).catch((e) => e);
        expect(onRefreshFailed).toHaveBeenCalledTimes(1);
        expect((err as ConnectError).code).toBe(Code.Unauthenticated);
    });

    it("dedupes concurrent refreshes", async () => {
        let refreshCalls = 0;
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => {
                refreshCalls++;
                await new Promise((r) => setTimeout(r, 5));
                return "new";
            },
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const next = async (req: UnaryRequest) => {
            if (req.header.get("Authorization") === "Bearer old")
                throw new ConnectError("401", Code.Unauthenticated);
            return okRes();
        };
        await Promise.all([
            i(next as never)(unaryReq()),
            i(next as never)(unaryReq()),
            i(next as never)(unaryReq()),
        ]);
        expect(refreshCalls).toBe(1);
    });

    it("refreshes once and retries a stream that fails Unauthenticated before it starts", async () => {
        const seen: (string | null)[] = [];
        const refresh = jest.fn(async () => "new");
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh,
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const streamReq = {
            ...unaryReq(),
            stream: true,
            method: { methodKind: "server_streaming" },
            message: createAsyncIterable([{ homeReferenceId: "h1" }]),
        } as never;
        const messages: unknown[][] = [];
        await i(async (req) => {
            seen.push(req.header.get("Authorization"));
            const got: unknown[] = [];
            for await (const m of req.message as AsyncIterable<unknown>) got.push(m);
            messages.push(got);
            if (seen.length === 1) throw new ConnectError("401", Code.Unauthenticated);
            return okRes();
        })(streamReq);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(seen).toEqual(["Bearer old", "Bearer new"]);
        expect(messages).toEqual([[{ homeReferenceId: "h1" }], [{ homeReferenceId: "h1" }]]);
    });

    it("does not retry client/bidi streams", async () => {
        let calls = 0;
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => "new",
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const streamReq = {
            ...unaryReq(),
            stream: true,
            method: { methodKind: "bidi_streaming" },
            message: createAsyncIterable([]),
        } as never;
        await i(async () => {
            calls++;
            throw new ConnectError("401", Code.Unauthenticated);
        })(streamReq).catch(() => undefined);
        expect(calls).toBe(1);
    });

    it("retries with the already-rotated token without refreshing again", async () => {
        // A request sent with "old" fails late, after another caller already finished a refresh.
        let current = "old";
        const refresh = jest.fn(async () => "newer");
        const tokens: string[] = [];
        const i = createAuthInterceptor({
            getAccessToken: () => current,
            refresh,
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
        });
        const res = await i(async (req) => {
            const t = req.header.get("Authorization")!;
            tokens.push(t);
            if (t === "Bearer old") {
                current = "new";
                throw new ConnectError("401", Code.Unauthenticated);
            }
            return okRes();
        })(unaryReq());
        expect(res).toBeTruthy();
        expect(refresh).not.toHaveBeenCalled();
        expect(tokens).toEqual(["Bearer old", "Bearer new"]);
    });

    it("treats a throwing refresh as a failed refresh", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const onRefreshFailed = jest.fn();
        const i = createAuthInterceptor({
            getAccessToken: () => "old",
            refresh: async () => {
                throw new Error("offline");
            },
            logout: jest.fn(),
            onRefreshFailed,
        });
        const err = await i(async () => {
            throw new ConnectError("401", Code.Unauthenticated);
        })(unaryReq()).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unauthenticated);
        expect(onRefreshFailed).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith("[Api] Refresh threw", expect.any(Error));
    });
});
