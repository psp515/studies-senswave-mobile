import {
    Code,
    ConnectError,
    createContextValues,
    type UnaryRequest,
    type UnaryResponse,
} from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { ApiError } from "@/api/errors";
import { createInterceptors } from "@/api/interceptors";

const req = () =>
    ({
        stream: false,
        service: UsersService,
        method: UsersService.method.getUser,
        url: "",
        signal: new AbortController().signal,
        header: new Headers(),
        contextValues: createContextValues(),
        message: {},
        requestMethod: "GET",
    }) as unknown as UnaryRequest;

type UnaryFn = (req: UnaryRequest) => Promise<UnaryResponse>;

const okRes = {
    stream: false,
    header: new Headers(),
    message: {},
    trailer: new Headers(),
} as unknown as UnaryResponse;

describe("createInterceptors chain", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const build = (inner: () => Promise<UnaryResponse>) => {
        const deps = {
            getAccessToken: () => "old",
            refresh: jest.fn(async () => "new"),
            logout: jest.fn(),
            onRefreshFailed: jest.fn(),
            onForbidden: jest.fn(),
        };
        const innerNext: UnaryFn = async () => inner();
        const chain = createInterceptors(deps).reduceRight<UnaryFn>(
            (next, i) => i(next as never) as unknown as UnaryFn,
            innerNext,
        );
        return { deps, chain };
    };

    it("refreshes once through the real conversion order", async () => {
        let calls = 0;
        const { deps, chain } = build(async () => {
            if (calls++ === 0) throw new ConnectError("401", Code.Unauthenticated);
            return okRes;
        });
        await expect(chain(req())).resolves.toBe(okRes);
        expect(deps.refresh).toHaveBeenCalledTimes(1);
        expect(calls).toBe(2);
    });

    it("surfaces PermissionDenied as ApiError and logs out", async () => {
        const { deps, chain } = build(async () => {
            throw new ConnectError("forbidden", Code.PermissionDenied);
        });
        const err = await chain(req()).catch((e: unknown) => e);
        expect(ApiError.is(err)).toBe(true);
        expect((err as ApiError).code).toBe(Code.PermissionDenied);
        expect(deps.logout).toHaveBeenCalled();
        expect(deps.onForbidden).toHaveBeenCalled();
    });
});
