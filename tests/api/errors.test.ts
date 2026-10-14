import { Code, ConnectError } from "@connectrpc/connect";
import { create, toBinary } from "@bufbuild/protobuf";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { ApiError, restProblemToErrors, toApiError, RestProblem } from "@/api/errors";

describe("restProblemToErrors", () => {
    it("parses Senswave ErrorProblemDetails", () => {
        const r = restProblemToErrors({
            statusCode: 404,
            title: "Not Found",
            type: "NotFound",
            errors: [{ code: "HomeNotFound", type: 3, description: "Home does not exist" }],
            traceId: "abc",
        });
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0].code).toBe("HomeNotFound");
        expect(r.errors[0].type).toBe(ErrorType.NOT_FOUND);
        expect(r.errors[0].description).toBe("Home does not exist");
        expect(r.traceId).toBe("abc");
        expect(r.message).toBe("Not Found");
    });

    it("parses Identity ValidationProblemDetails", () => {
        const r = restProblemToErrors({
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            title: "One or more validation errors occurred.",
            status: 400,
            errors: { PasswordTooShort: ["Passwords must be at least 6 characters."] },
        });
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0].code).toBe("PasswordTooShort");
        expect(r.errors[0].type).toBe(ErrorType.VALIDATION);
        expect(r.errors[0].description).toBe("Passwords must be at least 6 characters.");
    });

    it("prefers detail over title for message", () => {
        const r = restProblemToErrors({ title: "Unauthorized", detail: "NotAllowed", status: 401 });
        expect(r.message).toBe("NotAllowed");
        expect(r.errors).toHaveLength(0);
    });

    it("tolerates garbage", () => {
        expect(restProblemToErrors(null).errors).toEqual([]);
        expect(restProblemToErrors("text").errors).toEqual([]);
    });
});

describe("toApiError", () => {
    it("passes ApiError through", () => {
        const e = new ApiError({ code: Code.NotFound, message: "x" });
        expect(toApiError(e)).toBe(e);
    });

    it("reads senswave-errors-bin trailers from ConnectError", () => {
        const bin = toBinary(
            ErrorSchema,
            create(ErrorSchema, { code: "Conflict", type: ErrorType.CONFLICT, description: "dup" }),
        );
        const b64 = Buffer.from(bin).toString("base64");
        const md = new Headers();
        md.append("senswave-errors-bin", b64);
        md.append("senswave-trace-id", "trace-1");
        const ce = new ConnectError("already exists", Code.AlreadyExists, md);
        const e = toApiError(ce);
        expect(e.code).toBe(Code.AlreadyExists);
        expect(e.message).toBe("already exists");
        expect(e.errors[0].code).toBe("Conflict");
        expect(e.traceId).toBe("trace-1");
    });

    it("reads RestProblem cause", () => {
        const problem: RestProblem = {
            httpStatus: 403,
            body: { statusCode: 403, title: "Forbidden", type: "Legal", errors: [], traceId: "t" },
        };
        const ce = new ConnectError(
            "Forbidden",
            Code.PermissionDenied,
            undefined,
            undefined,
            problem,
        );
        const e = toApiError(ce);
        expect(e.httpStatus).toBe(403);
        expect(e.traceId).toBe("t");
        expect(e.code).toBe(Code.PermissionDenied);
    });

    it("wraps unknown as Unknown", () => {
        const e = toApiError(new Error("boom"));
        expect(e.code).toBe(Code.Unknown);
        expect(e.message).toBe("boom");
    });

    it("hasErrorCode and firstDescription", () => {
        const e = new ApiError({
            code: Code.InvalidArgument,
            message: "bad",
            errors: [create(ErrorSchema, { code: "X", description: "desc" })],
        });
        expect(e.hasErrorCode("X")).toBe(true);
        expect(e.firstDescription()).toBe("desc");
    });
});
