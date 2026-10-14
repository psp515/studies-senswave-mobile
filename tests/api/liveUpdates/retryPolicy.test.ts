import { Code, ConnectError } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";
import { isTerminalLiveUpdateError, nextRetryDelayMs } from "@/api/liveUpdates/retryPolicy";

const err = (code: Code) => new ApiError({ code, message: "x" });

describe("retryPolicy", () => {
    it.each([Code.PermissionDenied, Code.Unimplemented, Code.InvalidArgument])(
        "treats %s as terminal",
        (code) => {
            expect(isTerminalLiveUpdateError(err(code))).toBe(true);
            expect(nextRetryDelayMs(err(code), true)).toBeNull();
            expect(nextRetryDelayMs(err(code), false)).toBeNull();
        },
    );

    it("accepts ConnectError too", () => {
        expect(isTerminalLiveUpdateError(new ConnectError("x", Code.Unimplemented))).toBe(true);
    });

    it("retries 15s before initialized", () => {
        expect(nextRetryDelayMs(err(Code.Unavailable), false)).toBe(15000);
        expect(nextRetryDelayMs(err(Code.Internal), false)).toBe(15000);
    });

    it("retries quickly with jitter after initialized Unavailable", () => {
        expect(nextRetryDelayMs(err(Code.Unavailable), true, () => 0)).toBe(1000);
        expect(nextRetryDelayMs(err(Code.Unavailable), true, () => 0.5)).toBe(1500);
        const d = nextRetryDelayMs(err(Code.Unavailable), true)!;
        expect(d).toBeGreaterThanOrEqual(1000);
        expect(d).toBeLessThanOrEqual(2000);
    });

    it("keeps 15s for other codes after initialized", () => {
        expect(nextRetryDelayMs(err(Code.Internal), true)).toBe(15000);
    });
});
