import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ErrorSchema } from "@/api/gen/common/v1/common_pb";
import { ApiError } from "@/api/errors";
import { call, callSimple, isNotFound } from "@/api/call";
import { DefaultErrorToastText } from "@/api/toastDecision";

const ConnectionErrorText = "Connection error. Please check your internet connection.";

describe("call", () => {
    beforeEach(() => {
        jest.spyOn(console, "debug").mockImplementation(() => undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

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

    it("wraps non-ApiError without surfacing its message", async () => {
        const r = await call(async () => {
            throw new Error("boom");
        }, "fallback");
        expect(r.isSuccess).toBe(false);
        expect(r.error?.code).toBe(Code.Unknown);
        expect(r.errorMessage).toBe("fallback");
    });

    it("never surfaces the ApiError message (problem title)", async () => {
        const r = await call(async () => {
            throw new ApiError({ code: Code.NotFound, message: "Not Found" });
        }, "Home not found.");
        expect(r.errorMessage).toBe("Home not found.");
    });

    it.each([Code.Unavailable, Code.DeadlineExceeded])(
        "uses the connection message for code %s",
        async (code) => {
            const r = await callSimple(async () => {
                throw new ApiError({ code, message: "Network request failed" });
            }, "fallback");
            expect(r.errorMessage).toBe(ConnectionErrorText);
        },
    );

    it("prefers the first description over the connection message", async () => {
        const r = await call(async () => {
            throw new ApiError({
                code: Code.Unavailable,
                message: "x",
                errors: [create(ErrorSchema, { code: "Down", description: "Broker offline" })],
            });
        });
        expect(r.errorMessage).toBe("Broker offline");
    });

    it("ignores a whitespace-only description", async () => {
        const r = await call(async () => {
            throw new ApiError({
                code: Code.Internal,
                message: "x",
                errors: [create(ErrorSchema, { code: "X", description: "  " })],
            });
        }, "fallback");
        expect(r.errorMessage).toBe("fallback");
    });

    it("defaults to the generic toast text for call and callSimple", async () => {
        const fail = async () => {
            throw new ApiError({ code: Code.Internal, message: "" });
        };
        expect((await call(fail)).errorMessage).toBe(DefaultErrorToastText);
        expect((await callSimple(fail)).errorMessage).toBe(DefaultErrorToastText);
    });

    it("isNotFound matches only NotFound failures", async () => {
        const nf = await call(async () => {
            throw new ApiError({ code: Code.NotFound, message: "" });
        });
        const other = await call(async () => {
            throw new ApiError({ code: Code.Internal, message: "" });
        });
        const ok = await call(async () => 1);
        expect(isNotFound(nf)).toBe(true);
        expect(isNotFound(other)).toBe(false);
        expect(isNotFound(ok)).toBe(false);
    });
});
