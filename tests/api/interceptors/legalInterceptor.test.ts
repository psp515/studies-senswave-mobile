import { Code, ConnectError, createContextValues, type UnaryRequest } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { createLegalInterceptor } from "@/api/interceptors/legalInterceptor";

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

describe("legalInterceptor", () => {
    beforeEach(() => {
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("logs out on PermissionDenied and rethrows", async () => {
        const logout = jest.fn();
        const onForbidden = jest.fn();
        const i = createLegalInterceptor({ logout, onForbidden });
        const err = await i(async () => {
            throw new ConnectError("forbidden", Code.PermissionDenied);
        })(req()).catch((e) => e);
        expect(logout).toHaveBeenCalled();
        expect(onForbidden).toHaveBeenCalledWith(expect.anything());
        expect((err as ConnectError).code).toBe(Code.PermissionDenied);
    });

    it("ignores other codes", async () => {
        const logout = jest.fn();
        const i = createLegalInterceptor({ logout, onForbidden: jest.fn() });
        await i(async () => {
            throw new ConnectError("nf", Code.NotFound);
        })(req()).catch(() => undefined);
        expect(logout).not.toHaveBeenCalled();
    });

    it("does not log out on PermissionDenied for stream requests", async () => {
        const logout = jest.fn();
        const onForbidden = jest.fn();
        const i = createLegalInterceptor({ logout, onForbidden });
        const err = await i(async () => {
            throw new ConnectError("forbidden", Code.PermissionDenied);
        })({ ...req(), stream: true } as never).catch((e) => e);
        expect(logout).not.toHaveBeenCalled();
        expect(onForbidden).not.toHaveBeenCalled();
        expect((err as ConnectError).code).toBe(Code.PermissionDenied);
    });

    it("does not log out on PermissionDenied for the LiveUpdatesService", async () => {
        const logout = jest.fn();
        const i = createLegalInterceptor({ logout, onForbidden: jest.fn() });
        const err = await i(async () => {
            throw new ConnectError("forbidden", Code.PermissionDenied);
        })({
            ...req(),
            service: LiveUpdatesService,
            method: LiveUpdatesService.method.subscribe,
        } as never).catch((e) => e);
        expect(logout).not.toHaveBeenCalled();
        expect((err as ConnectError).code).toBe(Code.PermissionDenied);
    });
});
