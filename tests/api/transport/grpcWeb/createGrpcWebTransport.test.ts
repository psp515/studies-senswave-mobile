import { Code, createClient } from "@connectrpc/connect";
import { create, toBinary } from "@bufbuild/protobuf";
import { encodeEnvelope } from "@connectrpc/connect/protocol";
import { UsersService, GetUserResponseSchema } from "@/api/gen/users/v1/users_pb";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { LiveUpdateSchema, LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { call } from "@/api/call";
import { ApiError } from "@/api/errors";
import { createInterceptors } from "@/api/interceptors";
import { createSenswaveGrpcWebTransport } from "@/api/transport/grpcWeb/createGrpcWebTransport";

const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]): Uint8Array => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
};
const dataFrame = (bytes: Uint8Array) => encodeEnvelope(0, bytes);
const trailerFrame = (lines: Record<string, string>) =>
    encodeEnvelope(
        0x80,
        enc.encode(
            Object.entries(lines)
                .map(([k, v]) => `${k}: ${v}\r\n`)
                .join(""),
        ),
    );
const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

const grpcWebResponse = (body: Uint8Array) =>
    new Response(body as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/grpc-web+proto" },
    });

const setup = (respond: () => Response, token = "tok") => {
    const fetchSpy = jest.fn(async (_url: unknown, _init?: RequestInit) => respond());
    const deps = {
        getAccessToken: () => token,
        refresh: async () => null,
        logout: jest.fn(),
        onRefreshFailed: jest.fn(),
        onForbidden: jest.fn(),
    };
    const transport = createSenswaveGrpcWebTransport({
        baseUrl: "https://h",
        fetch: fetchSpy as unknown as typeof fetch,
        interceptors: createInterceptors(deps),
    });
    return { fetchSpy, deps, transport };
};

describe("gRPC-Web transport", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(console, "debug").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("performs a unary call with grpc-web content type, URL and auth header", async () => {
        const msg = toBinary(
            GetUserResponseSchema,
            create(GetUserResponseSchema, { id: "1", email: "a@b.c" }),
        );
        const { fetchSpy, transport } = setup(() =>
            grpcWebResponse(concat(dataFrame(msg), trailerFrame({ "grpc-status": "0" }))),
        );
        const user = await createClient(UsersService, transport).getUser({});
        expect(user.email).toBe("a@b.c");

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe("https://h/senswave.users.v1.UsersService/GetUser");
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toBe("application/grpc-web+proto");
        expect(headers.get("Authorization")).toBe("Bearer tok");
    });

    it("maps a trailer error to ApiError NotFound with decoded errors", async () => {
        const errBytes = toBinary(
            ErrorSchema,
            create(ErrorSchema, {
                code: "User.NotFound",
                type: ErrorType.NOT_FOUND,
                description: "No such user",
            }),
        );
        const { transport } = setup(() =>
            grpcWebResponse(
                trailerFrame({
                    "grpc-status": "5",
                    "grpc-message": "not found",
                    "senswave-errors-bin": toBase64(errBytes),
                }),
            ),
        );
        const client = createClient(UsersService, transport);
        const result = await call(() => client.getUser({}));
        expect(result.isSuccess).toBe(false);
        const err = result.error as ApiError;
        expect(err.code).toBe(Code.NotFound);
        expect(err.errors[0].code).toBe("User.NotFound");
    });

    it("streams enveloped messages followed by a trailer", async () => {
        const update = (c: "initialized" | "deviceTile") =>
            toBinary(
                LiveUpdateSchema,
                create(LiveUpdateSchema, {
                    update:
                        c === "initialized"
                            ? { case: "initialized", value: {} }
                            : { case: "deviceTile", value: { deviceId: "d1" } },
                }),
            );
        const { fetchSpy, transport } = setup(() =>
            grpcWebResponse(
                concat(
                    dataFrame(update("initialized")),
                    dataFrame(update("deviceTile")),
                    trailerFrame({ "grpc-status": "0" }),
                ),
            ),
        );
        const client = createClient(LiveUpdatesService, transport);
        const cases: (string | undefined)[] = [];
        for await (const u of client.subscribe({ homeReferenceId: "h1" })) {
            cases.push(u.update.case);
        }
        expect(cases).toEqual(["initialized", "deviceTile"]);
        expect(fetchSpy.mock.calls[0][0]).toBe(
            "https://h/senswave.liveupdates.v1.LiveUpdatesService/Subscribe",
        );
    });
});
