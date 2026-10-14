import { Result, SimpleResult } from "@/utils/result";

describe("Result", () => {
    it("success carries data", () => {
        const r = Result.success(42);
        expect(r.isSuccess).toBe(true);
        expect(r.data).toBe(42);
        expect(r.errorMessage).toBeNull();
    });

    it("failureWithData carries both", () => {
        const r = Result.failureWithData("bad", true);
        expect(r.isSuccess).toBe(false);
        expect(r.data).toBe(true);
        expect(r.errorMessage).toBe("bad");
    });

    it("SimpleResult.failure carries message", () => {
        expect(SimpleResult.failure("x").errorMessage).toBe("x");
    });
});
