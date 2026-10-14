import { Code } from "@connectrpc/connect";
import { createAnonymousApi } from "@/api/anonymousClients";
import { call } from "@/api/call";

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("createAnonymousApi", () => {
    it("calls auth.login over REST without Authorization header", async () => {
        let headers: Headers | undefined;
        const api = createAnonymousApi({
            baseUrl: "https://h",
            mode: "Rest",
            fetch: async (_u, init) => {
                headers = new Headers(init?.headers);
                return json(200, {
                    tokenType: "Bearer",
                    accessToken: "a",
                    expiresIn: 1,
                    refreshToken: "r",
                });
            },
        });
        const r = await call(() => api.auth.login({ email: "e", password: "p" }));
        expect(r.isSuccess).toBe(true);
        expect(r.data?.accessToken).toBe("a");
        expect(headers?.get("Authorization")).toBeNull();
        expect(api.transportMode).toBe("Rest");
    });

    it("surfaces ApiError with code and message from a 401 problem", async () => {
        const api = createAnonymousApi({
            baseUrl: "https://h",
            mode: "Rest",
            fetch: async () =>
                json(401, { title: "Unauthorized", detail: "NotAllowed", status: 401 }),
        });
        const r = await call(() => api.auth.login({ email: "e", password: "p" }));
        expect(r.error?.code).toBe(Code.Unauthenticated);
        expect(r.error?.message).toBe("NotAllowed");
    });

    it("missing base URL yields Unavailable without throwing", async () => {
        const api = createAnonymousApi({ baseUrl: null, mode: "Rest" });
        const r = await call(() => api.legal.getTermsAndConditions({}));
        expect(r.error?.code).toBe(Code.Unavailable);
    });
});
