import { Code } from "@connectrpc/connect";
import { httpStatusToCode } from "@/api/transport/rest/httpStatusToCode";

describe("httpStatusToCode", () => {
    it.each([
        [400, Code.InvalidArgument],
        [401, Code.Unauthenticated],
        [403, Code.PermissionDenied],
        [404, Code.NotFound],
        [408, Code.DeadlineExceeded],
        [409, Code.AlreadyExists],
        [422, Code.InvalidArgument],
        [429, Code.ResourceExhausted],
        [500, Code.Internal],
        [501, Code.Unimplemented],
        [503, Code.Unavailable],
        [504, Code.DeadlineExceeded],
        [418, Code.Unknown],
    ])("%i → %s", (status, code) => {
        expect(httpStatusToCode(status)).toBe(code);
    });
});
