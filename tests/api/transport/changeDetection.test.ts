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
});
