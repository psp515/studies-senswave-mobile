import { Code } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";
import { toastTextFor } from "@/api/toastDecision";

const failed = (code: Code | undefined, errorMessage: string | null) => ({
    isSuccess: false,
    errorMessage,
    error: code === undefined ? undefined : new ApiError({ code, message: "" }),
});

describe("toastTextFor", () => {
    it("success → null", () => {
        expect(toastTextFor({ isSuccess: true, errorMessage: null })).toBeNull();
    });
    it("Unauthenticated and PermissionDenied → null (already handled)", () => {
        expect(toastTextFor(failed(Code.Unauthenticated, "x"))).toBeNull();
        expect(toastTextFor(failed(Code.PermissionDenied, "x"))).toBeNull();
    });
    it("other failure → errorMessage", () => {
        expect(toastTextFor(failed(Code.NotFound, "Missing"))).toBe("Missing");
    });
    it("failure without message → fallback", () => {
        expect(toastTextFor(failed(undefined, null), "Oops")).toBe("Oops");
        expect(toastTextFor(failed(undefined, ""))).toBe("An unexpected error occurred.");
    });
});
