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

    it("retries a server stream with the refreshed token after trailers-only Unauthenticated", async () => {
        const live = toBinary(
            LiveUpdateSchema,
            create(LiveUpdateSchema, { update: { case: "initialized", value: {} } }),
        );
        let n = 0;
        const auths: (string | null)[] = [];
        const fetchSpy = jest.fn(async (_url: unknown, init?: RequestInit) => {
            // The same Headers object is mutated across attempts, so capture it per call.
            auths.push(new Headers(init?.headers).get("Authorization"));
            return ++n === 1
                ? // trailers-only: status travels in the HTTP headers with an empty body
                  new Response(null, {
                      status: 200,
                      headers: {
                          "Content-Type": "application/grpc-web+proto",
                          "grpc-status": "16",
                          "grpc-message": "expired",
                      },
                  })
                : grpcWebResponse(concat(dataFrame(live), trailerFrame({ "grpc-status": "0" })));
        });
        let token = "old";
        const transport = createSenswaveGrpcWebTransport({
            baseUrl: "https://h",
            fetch: fetchSpy as unknown as typeof fetch,
            interceptors: createInterceptors({
                getAccessToken: () => token,
                refresh: async () => (token = "new"),
                logout: jest.fn(),
                onRefreshFailed: jest.fn(),
                onForbidden: jest.fn(),
            }),
        });
        const cases: (string | undefined)[] = [];
        for await (const u of createClient(LiveUpdatesService, transport).subscribe({
            homeReferenceId: "h1",
        })) {
            cases.push(u.update.case);
        }
        expect(cases).toEqual(["initialized"]);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(auths).toEqual(["Bearer old", "Bearer new"]);
    });

    describe("stream deadline", () => {
        const okStream = () =>
            grpcWebResponse(
                concat(
                    dataFrame(
                        toBinary(
                            LiveUpdateSchema,
                            create(LiveUpdateSchema, {
                                update: { case: "initialized", value: {} },
                            }),
                        ),
                    ),
                    trailerFrame({ "grpc-status": "0" }),
                ),
            );
        const drain = async (
            transport: ReturnType<typeof setup>["transport"],
            options?: { timeoutMs?: number },
        ) => {
            for await (const u of createClient(LiveUpdatesService, transport).subscribe(
                { homeReferenceId: "h1" },
                options,
            )) {
                expect(u).toBeDefined();
            }
        };

        it("sends no grpc-timeout header when timeoutMs is 0", async () => {
            const { fetchSpy, transport } = setup(okStream);
            await drain(transport, { timeoutMs: 0 });
            const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers);
            expect(headers.has("grpc-timeout")).toBe(false);
        });

        it("sends the default grpc-timeout header when timeoutMs is omitted", async () => {
            const { fetchSpy, transport } = setup(okStream);
            await drain(transport);
            const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers);
            expect(headers.get("grpc-timeout")).toBe("15000m");
        });
    });

    it("retries a server stream after a plain HTTP 401 without grpc-status", async () => {
        const live = toBinary(
            LiveUpdateSchema,
            create(LiveUpdateSchema, { update: { case: "initialized", value: {} } }),
        );
        let n = 0;
        const auths: (string | null)[] = [];
        const fetchSpy = jest.fn(async (_url: unknown, init?: RequestInit) => {
            auths.push(new Headers(init?.headers).get("Authorization"));
            return ++n === 1
                ? new Response("unauthorized", { status: 401 })
                : grpcWebResponse(concat(dataFrame(live), trailerFrame({ "grpc-status": "0" })));
        });
        let token = "old";
        const transport = createSenswaveGrpcWebTransport({
            baseUrl: "https://h",
            fetch: fetchSpy as unknown as typeof fetch,
            interceptors: createInterceptors({
                getAccessToken: () => token,
                refresh: async () => (token = "new"),
                logout: jest.fn(),
                onRefreshFailed: jest.fn(),
                onForbidden: jest.fn(),
            }),
        });
        const cases: (string | undefined)[] = [];
        for await (const u of createClient(LiveUpdatesService, transport).subscribe({
            homeReferenceId: "h1",
        })) {
            cases.push(u.update.case);
        }
        expect(cases).toEqual(["initialized"]);
        expect(auths).toEqual(["Bearer old", "Bearer new"]);
    });
});
