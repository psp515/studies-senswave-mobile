import { Code, ConnectError, createContextValues, type UnaryRequest } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { createErrorInterceptor } from "@/api/interceptors/errorInterceptor";
import { ApiError } from "@/api/errors";

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

describe("errorInterceptor", () => {
    it("converts ConnectError into ApiError", async () => {
        const i = createErrorInterceptor();
        const err = await i(async () => {
            throw new ConnectError("nf", Code.NotFound);
        })(req()).catch((e) => e);
        expect(ApiError.is(err)).toBe(true);
        expect((err as ApiError).code).toBe(Code.NotFound);
    });

    it("converts unknown errors", async () => {
        const i = createErrorInterceptor();
        const err = await i(async () => {
            throw new Error("x");
        })(req()).catch((e) => e);
        expect(ApiError.is(err)).toBe(true);
        expect((err as ApiError).code).toBe(Code.Unknown);
    });
});
