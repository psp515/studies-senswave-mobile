import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { UsersService, GetUserRequestSchema } from "@/api/gen/users/v1/users_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { createRestTransport } from "@/api/transport/rest/createRestTransport";
import { defineRoutes } from "@/api/transport/rest/RestRoute";
import { isRestProblem } from "@/api/errors";

const jsonResponse = (status: number, body: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
    });

const routes = defineRoutes(UsersService, {
    getUser: {
        method: "GET",
        path: () => "v1/users",
        response: (json) => {
            const j = json as {
                id: string;
                email: string;
                theme: string;
                language: string;
                hasActiveConsent: boolean;
            };
            return {
                id: j.id,
                email: j.email,
                theme: j.theme,
                language: j.language,
                hasActiveConsent: j.hasActiveConsent,
            };
        },
    },
    updateSettings: {
        method: "PATCH",
        path: () => "v1/users/settings",
        body: (req) => ({ theme: req.theme || undefined, language: req.language || undefined }),
        response: () => ({}),
    },
    createConsents: {
        method: "POST",
        path: () => "v1/users/consents",
        body: () => ({}),
        response: () => ({}),
    },
    deleteAccount: { method: "DELETE", path: () => "v1/users/account", response: () => ({}) },
});

describe("createRestTransport", () => {
    it("builds URL, method, headers and parses the response", async () => {
        const calls: { url: string; init: RequestInit }[] = [];
        const fetchMock: typeof fetch = async (url, init) => {
            calls.push({ url: String(url), init: init ?? {} });
            return jsonResponse(200, {
                id: "1",
                email: "a@b.c",
                theme: "dark",
                language: "pl",
                hasActiveConsent: true,
            });
        };
        const transport = createRestTransport({
            baseUrl: "https://host:7070/",
            routes,
            fetch: fetchMock,
        });
        const client = createClient(UsersService, transport);

        const res = await client.getUser(create(GetUserRequestSchema, {}), {
            headers: { Authorization: "Bearer t" },
        });

        expect(res.email).toBe("a@b.c");
        expect(res.hasActiveConsent).toBe(true);
        expect(calls[0].url).toBe("https://host:7070/api/v1/users");
        expect(calls[0].init.method).toBe("GET");
        const headers = new Headers(calls[0].init.headers);
        expect(headers.get("Authorization")).toBe("Bearer t");
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(calls[0].init.body).toBeUndefined();
    });

    it("serialises body for PATCH", async () => {
        let body: string | undefined;
        const fetchMock: typeof fetch = async (_url, init) => {
            body = init?.body as string;
            return jsonResponse(204, undefined);
        };
        const client = createClient(
            UsersService,
            createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock }),
        );
        await client.updateSettings({ theme: "light" });
        expect(JSON.parse(body!)).toEqual({ theme: "light" });
    });

    it("maps non-2xx to ConnectError with RestProblem cause", async () => {
        const problem = {
            statusCode: 404,
            title: "Not Found",
            type: "x",
            errors: [],
            traceId: "t1",
        };
        const fetchMock: typeof fetch = async () => jsonResponse(404, problem);
        const client = createClient(
            UsersService,
            createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock }),
        );

        const err = await client.getUser({}).catch((e) => e);
        expect(err).toBeInstanceOf(ConnectError);
        expect((err as ConnectError).code).toBe(Code.NotFound);
        expect(isRestProblem((err as ConnectError).cause)).toBe(true);
        expect(((err as ConnectError).cause as { httpStatus: number }).httpStatus).toBe(404);
    });

    it("maps network failure to Unavailable", async () => {
        const fetchMock: typeof fetch = async () => {
            throw new TypeError("Network request failed");
        };
        const client = createClient(
            UsersService,
            createRestTransport({ baseUrl: "https://h", routes, fetch: fetchMock }),
        );
        const err = await client.getUser({}).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unavailable);
    });

    it("applies deadline", async () => {
        const fetchMock: typeof fetch = (_url, init) =>
            new Promise((_, reject) => {
                init?.signal?.addEventListener("abort", () =>
                    reject(new DOMException("aborted", "AbortError")),
                );
            });
        const client = createClient(
            UsersService,
            createRestTransport({
                baseUrl: "https://h",
                routes,
                fetch: fetchMock,
                defaultTimeoutMs: 20,
            }),
        );
        const err = await client.getUser({}).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.DeadlineExceeded);
    });

    it("runs interceptors", async () => {
        const seen: string[] = [];
        const fetchMock: typeof fetch = async (_u, init) => {
            seen.push(new Headers(init?.headers).get("x-test") ?? "");
            return jsonResponse(200, {
                id: "1",
                email: "e",
                theme: "",
                language: "",
                hasActiveConsent: false,
            });
        };
        const transport = createRestTransport({
            baseUrl: "https://h",
            routes,
            fetch: fetchMock,
            interceptors: [
                (next) => async (req) => {
                    req.header.set("x-test", "yes");
                    return next(req);
                },
            ],
        });
        await createClient(UsersService, transport).getUser({});
        expect(seen).toEqual(["yes"]);
    });

    it("rejects streams as Unimplemented", async () => {
        const transport = createRestTransport({
            baseUrl: "https://h",
            routes,
            fetch: async () => jsonResponse(200, {}),
        });
        const client = createClient(LiveUpdatesService, transport);
        const err = await (async () => {
            await client.subscribe({ homeReferenceId: "h" })[Symbol.asyncIterator]().next();
        })().catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unimplemented);
    });

    it("throws Unimplemented for an RPC without a route", async () => {
        const transport = createRestTransport({
            baseUrl: "https://h",
            routes: [],
            fetch: async () => jsonResponse(200, {}),
        });
        const err = await createClient(UsersService, transport)
            .getUser({})
            .catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.Unimplemented);
    });

    it("propagates a ConnectError thrown by route.path()", async () => {
        const throwing = defineRoutes(UsersService, {
            getUser: {
                method: "GET",
                path: () => {
                    throw new ConnectError("Missing id", Code.InvalidArgument);
                },
                response: () => ({}),
            },
            updateSettings: { method: "PATCH", path: () => "x", response: () => ({}) },
            createConsents: { method: "POST", path: () => "x", response: () => ({}) },
            deleteAccount: { method: "DELETE", path: () => "x", response: () => ({}) },
        });
        const fetchMock = jest.fn(async () => jsonResponse(200, {}));
        const client = createClient(
            UsersService,
            createRestTransport({ baseUrl: "https://h", routes: throwing, fetch: fetchMock }),
        );
        const err = await client.getUser({}).catch((e) => e);
        expect((err as ConnectError).code).toBe(Code.InvalidArgument);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
