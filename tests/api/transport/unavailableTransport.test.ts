import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { createUnavailableTransport } from "@/api/transport/createTransport";
import { call } from "@/api/call";

describe("createUnavailableTransport", () => {
    it("rejects unary calls with Unavailable and the given reason", async () => {
        const client = createClient(UsersService, createUnavailableTransport("no url"));
        const err = await client.getUser({}).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ConnectError);
        expect((err as ConnectError).code).toBe(Code.Unavailable);
        expect((err as ConnectError).rawMessage).toBe("no url");
    });

    it("rejects streaming calls with Unavailable", async () => {
        const method = LiveUpdatesService.methods[0];
        expect(method.methodKind).toBe("server_streaming");
        const transport = createUnavailableTransport("no url");
        const err = await transport
            .stream(method as never, undefined, undefined, undefined, (async function* () {})())
            .catch((e: unknown) => e);
        expect((err as ConnectError).code).toBe(Code.Unavailable);
    });

    it("folds into a connection-error Result via call()", async () => {
        jest.spyOn(console, "debug").mockImplementation(() => undefined);
        const client = createClient(UsersService, createUnavailableTransport("no url"));
        const result = await call(() => client.getUser({}), "fallback");
        expect(result.error?.code).toBe(Code.Unavailable);
        expect(result.errorMessage).toBe(
            "Connection error. Please check your internet connection.",
        );
        jest.restoreAllMocks();
    });
});
