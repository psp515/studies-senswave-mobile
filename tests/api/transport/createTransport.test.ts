import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { resolveBaseUrl, resolveTransport } from "@/api/transport/createTransport";

describe("resolveTransport", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("builds the requested Rest transport", () => {
        const r = resolveTransport({ mode: "Rest", baseUrl: "https://h", interceptors: [] });
        expect(r.mode).toBe("Rest");
        expect(console.error).not.toHaveBeenCalled();
    });

    it.each(["Grpc"] as const)("falls back to Rest when %s is not implemented", async (mode) => {
        const fetchMock = jest.fn(
            async () =>
                new Response(JSON.stringify({ email: "a@b" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
        );
        const r = resolveTransport({
            mode,
            baseUrl: "https://h",
            interceptors: [],
            fetch: fetchMock as unknown as typeof fetch,
        });
        expect(r.mode).toBe("Rest");
        expect(console.error).toHaveBeenCalledTimes(1);
        const user = await createClient(UsersService, r.transport).getUser({});
        expect(user.email).toBe("a@b");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("builds the GrpcWeb transport without falling back", () => {
        const r = resolveTransport({ mode: "GrpcWeb", baseUrl: "https://h", interceptors: [] });
        expect(r.mode).toBe("GrpcWeb");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("uses the unavailable transport when the base URL is missing", async () => {
        const r = resolveTransport({ mode: "Rest", baseUrl: null, interceptors: [] });
        expect(r.mode).toBe("Rest");
        const err = await createClient(UsersService, r.transport)
            .getUser({})
            .catch((e: unknown) => e);
        expect((err as ConnectError).code).toBe(Code.Unavailable);
        expect((err as ConnectError).rawMessage).toBe("API base URL is not configured");
    });
});

describe("resolveBaseUrl", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns the origin of a valid URL", () => {
        expect(resolveBaseUrl(() => new URL("https://h:7070/x"))).toBe("https://h:7070");
    });

    it("returns null when getBaseUrl throws", () => {
        expect(
            resolveBaseUrl(() => {
                throw new TypeError("Invalid URL");
            }),
        ).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("returns null for an opaque origin", () => {
        expect(resolveBaseUrl(() => new URL("localhost:8080"))).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
