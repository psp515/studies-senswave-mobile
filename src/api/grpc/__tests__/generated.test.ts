import { GetPrivacyPolicyResponse, LegalService } from "@/generated/users/v1/legal";

describe("generated contracts", () => {
    it("round-trips a message through the binary format", () => {
        const message = GetPrivacyPolicyResponse.create({
            id: "1",
            version: "1.0.0",
            summary: "summary",
            content: "content",
        });

        const bytes = GetPrivacyPolicyResponse.toBinary(message);

        expect(GetPrivacyPolicyResponse.fromBinary(bytes)).toEqual(message);
    });

    it("exposes the backend service and method names", () => {
        expect(LegalService.typeName).toBe("senswave.users.v1.LegalService");
        expect(LegalService.methods.map((m) => m.name)).toEqual([
            "GetPrivacyPolicy",
            "GetTermsAndConditions",
        ]);
    });
});
