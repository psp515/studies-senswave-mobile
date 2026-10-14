import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { legalRoutes } from "@/api/transport/rest/routes/legal";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof LegalService.method) =>
    legalRoutes.find((e) => e.key === routeKey(LegalService.method[name]))!.route;

describe("legal REST routes", () => {
    it("covers every RPC", () => {
        expect(legalRoutes).toHaveLength(LegalService.methods.length);
    });

    it("maps terms with timestamp", () => {
        const r = route("getTermsAndConditions");
        expect(r.method).toBe("GET");
        expect(r.path({} as never)).toBe("v1/legal/terms");
        const out = r.response(
            {
                id: "1",
                version: "2",
                content: "c",
                summary: "s",
                createdAtUtc: "2026-01-02T03:04:05Z",
            },
            200,
        ) as { createdAtUtc?: { seconds: bigint } };
        expect(out.createdAtUtc?.seconds).toBe(BigInt(Date.UTC(2026, 0, 2, 3, 4, 5) / 1000));
    });

    it("privacy path", () => {
        expect(route("getPrivacyPolicy").path({} as never)).toBe("v1/legal/privacy");
    });
});
