import { Code, createClient } from "@connectrpc/connect";
import { UsersService } from "@/api/gen/users/v1/users_pb";
import { call, callSimple } from "@/api/call";
import { createInterceptors } from "@/api/interceptors";
import { createRestTransport } from "@/api/transport/rest/createRestTransport";
import { restRoutes } from "@/api/transport/rest/routes";

const ConnectionErrorText = "Connection error. Please check your internet connection.";

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

const userJson = {
    id: "1",
    email: "a@b.c",
    theme: "dark",
    language: "pl",
    hasActiveConsent: true,
};

/** A fetch that never resolves on its own but rejects when its signal aborts, like real fetch. */
const hangingFetch: typeof fetch = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason));
    });

const setup = (fetchMock: typeof fetch, token: string | null = "old") => {
    const deps = {
        getAccessToken: jest.fn(() => token),
        refresh: jest.fn(async () => {
            token = "new";
            return "new";
        }),
        logout: jest.fn(),
        onRefreshFailed: jest.fn(),
        onForbidden: jest.fn(),
    };
    const fetchSpy = jest.fn(fetchMock);
    const client = createClient(
        UsersService,
        createRestTransport({
            baseUrl: "https://h",
            routes: restRoutes,
            interceptors: createInterceptors(deps),
            fetch: fetchSpy as unknown as typeof fetch,
        }),
    );
    return { deps, fetchSpy, client };
};

describe("REST transport + interceptor chain + call()", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(console, "debug").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("maps a Senswave problem body to NotFound with errors and httpStatus", async () => {
        const { client } = setup(async () =>
            jsonResponse(404, {
                statusCode: 404,
                title: "Not Found",
                type: "x",
                errors: [{ code: "UserNotFound", type: 3, description: "No user" }],
                traceId: "t",
            }),
        );
        const result = await call(() => client.getUser({}), "Failed to load user.");
        expect(result.isSuccess).toBe(false);
        expect(result.error?.code).toBe(Code.NotFound);
        expect(result.error?.httpStatus).toBe(404);
        expect(result.error?.errors[0].code).toBe("UserNotFound");
        expect(result.error?.traceId).toBe("t");
        expect(result.errorMessage).toBe("No user");
    });

    it("refreshes once on 401 and retries with the new token", async () => {
        let n = 0;
        const { client, deps, fetchSpy } = setup(async () =>
            n++ === 0 ? jsonResponse(401, { title: "Unauthorized" }) : jsonResponse(200, userJson),
        );
        const result = await call(() => client.getUser({}));
        expect(result.isSuccess).toBe(true);
        expect(result.data?.email).toBe("a@b.c");
        expect(deps.refresh).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        const secondInit = fetchSpy.mock.calls[1][1] as RequestInit;
        expect(new Headers(secondInit.headers).get("Authorization")).toBe("Bearer new");
    });

    it("maps 403 to PermissionDenied and logs out once", async () => {
        const { client, deps } = setup(async () => jsonResponse(403, { title: "Forbidden" }));
        const result = await callSimple(() => client.createConsents({}));
        expect(result.isSuccess).toBe(false);
        expect(result.error?.code).toBe(Code.PermissionDenied);
        expect(deps.logout).toHaveBeenCalledTimes(1);
        expect(deps.onForbidden).toHaveBeenCalledTimes(1);
    });

    it("fails Unauthenticated without fetching when there is no token", async () => {
        const { client, deps, fetchSpy } = setup(async () => jsonResponse(200, userJson), null);
        const result = await call(() => client.getUser({}));
        expect(result.error?.code).toBe(Code.Unauthenticated);
        expect(deps.logout).toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("maps a network failure to Unavailable with the connection message", async () => {
        const { client } = setup(async () => {
            throw new TypeError("Network request failed");
        });
        const result = await call(() => client.getUser({}), "Failed to load user.");
        expect(result.error?.code).toBe(Code.Unavailable);
        expect(result.errorMessage).toBe(ConnectionErrorText);
    });

    it("maps a per-call timeout to DeadlineExceeded with the connection message", async () => {
        const { client } = setup(hangingFetch);
        const result = await call(() => client.getUser({}, { timeoutMs: 20 }), "fallback");
        expect(result.error?.code).toBe(Code.DeadlineExceeded);
        expect(result.errorMessage).toBe(ConnectionErrorText);
    });

    it("uses the caller fallback for a non-JSON 500", async () => {
        const { client } = setup(async () => new Response("<html>oops</html>", { status: 500 }));
        const result = await call(() => client.getUser({}), "Failed to load user.");
        expect(result.error?.code).toBe(Code.Internal);
        expect(result.error?.httpStatus).toBe(500);
        expect(result.errorMessage).toBe("Failed to load user.");
    });

    it("maps a caller abort to Canceled", async () => {
        const { client } = setup(hangingFetch);
        const controller = new AbortController();
        const pending = call(() => client.getUser({}, { signal: controller.signal }));
        controller.abort();
        const result = await pending;
        expect(result.error?.code).toBe(Code.Canceled);
    });
});
