import { shouldLogoutOnChange } from "@/api/transport/changeDetection";

const a = { baseUrl: "https://a", mode: "Rest" } as const;

describe("shouldLogoutOnChange", () => {
    it("is false on first mount", () => {
        expect(shouldLogoutOnChange(null, a)).toBe(false);
    });
    it("is false when nothing changed", () => {
        expect(shouldLogoutOnChange(a, { ...a })).toBe(false);
    });
    it("is true when the base URL changed", () => {
        expect(shouldLogoutOnChange(a, { ...a, baseUrl: "https://b" })).toBe(true);
    });
    it("is true when the mode changed", () => {
        expect(shouldLogoutOnChange(a, { ...a, mode: "GrpcWeb" })).toBe(true);
    });
    it("is false when a requested mode falls back to the previous effective mode", () => {
        // Requested Grpc is unimplemented and resolves to Rest: identity uses the effective mode.
        const effective = { baseUrl: "https://a", mode: "Rest" } as const;
        expect(shouldLogoutOnChange(a, effective)).toBe(false);
    });
});
