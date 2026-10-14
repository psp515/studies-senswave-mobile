import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ErrorSchema } from "@/api/gen/common/v1/common_pb";
import { ApiError } from "@/api/errors";
import { call, callSimple } from "@/api/call";

describe("call", () => {
    it("wraps success", async () => {
        const r = await call(async () => 5);
        expect(r.isSuccess).toBe(true);
        expect(r.data).toBe(5);
    });

    it("wraps ApiError using first description", async () => {
        const e = new ApiError({
            code: Code.NotFound,
            message: "nf",
            errors: [create(ErrorSchema, { code: "X", description: "Missing" })],
        });
        const r = await call(async () => {
            throw e;
        }, "fallback");
        expect(r.isSuccess).toBe(false);
        expect(r.errorMessage).toBe("Missing");
        expect(r.error).toBe(e);
    });

    it("uses fallback when no description", async () => {
        const r = await callSimple(async () => {
            throw new ApiError({ code: Code.Internal, message: "" });
        }, "Failed to update theme.");
        expect(r.errorMessage).toBe("Failed to update theme.");
    });

    it("wraps non-ApiError", async () => {
        const r = await call(async () => {
            throw new Error("boom");
        });
        expect(r.isSuccess).toBe(false);
        expect(r.error?.code).toBe(Code.Unknown);
    });
});
