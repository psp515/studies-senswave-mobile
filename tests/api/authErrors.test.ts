import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { ApiError } from "@/api/errors";
import { identityValidationFailure, isServerFailure, loginFailure } from "@/api/authErrors";

const apiError = (code: Code, message = "", errors: { code: string; description: string }[] = []) =>
    new ApiError({
        code,
        message,
        errors: errors.map((e) => create(ErrorSchema, { ...e, type: ErrorType.VALIDATION })),
    });

describe("isServerFailure", () => {
    it.each([Code.Unavailable, Code.DeadlineExceeded, Code.Internal, Code.Unknown])(
        "%s → true",
        (c) => {
            expect(isServerFailure(apiError(c))).toBe(true);
        },
    );
    it("Unauthenticated → false", () => {
        expect(isServerFailure(apiError(Code.Unauthenticated))).toBe(false);
    });
});

describe("loginFailure", () => {
    it("NotAllowed → confirm email, show resend", () => {
        const r = loginFailure(apiError(Code.Unauthenticated, "NotAllowed"));
        expect(r.isSuccess).toBe(false);
        expect(r.errorMessage).toBe("Please confirm your email.");
        expect(r.data).toBe(true);
        expect(r.error?.code).toBe(Code.Unauthenticated);
    });
    it("other Unauthenticated → invalid credentials", () => {
        const r = loginFailure(apiError(Code.Unauthenticated, "Failed"));
        expect(r.errorMessage).toBe("Invalid email or password.");
        expect(r.data).toBe(false);
    });
    it("server failure", () => {
        expect(loginFailure(apiError(Code.Unavailable)).errorMessage).toBe("Server not available.");
    });
    it("non-Connect error is Unknown → server failure", () => {
        expect(loginFailure(new Error("boom")).errorMessage).toBe("Server not available.");
    });
    it("anything else", () => {
        expect(loginFailure(apiError(Code.PermissionDenied)).errorMessage).toBe(
            "Login failed unexpectedly.",
        );
        expect(loginFailure(apiError(Code.NotFound)).errorMessage).toBe(
            "Login failed unexpectedly.",
        );
    });
});

describe("identityValidationFailure", () => {
    it("picks first non-DuplicateUserName description", () => {
        const r = identityValidationFailure(
            apiError(Code.InvalidArgument, "", [
                { code: "DuplicateUserName", description: "Username taken" },
                {
                    code: "PasswordTooShort",
                    description: "Passwords must be at least 6 characters.",
                },
            ]),
            "Registration failed unexpectedly.",
        );
        expect(r.errorMessage).toBe("Passwords must be at least 6 characters.");
    });
    it("only DuplicateUserName → Something went wrong.", () => {
        const r = identityValidationFailure(
            apiError(Code.InvalidArgument, "", [{ code: "DuplicateUserName", description: "x" }]),
            "fallback",
        );
        expect(r.errorMessage).toBe("Something went wrong.");
    });
    it("server failure", () => {
        expect(identityValidationFailure(apiError(Code.Internal), "fb").errorMessage).toBe(
            "Server not available.",
        );
    });
    it("other codes → fallback", () => {
        expect(identityValidationFailure(apiError(Code.NotFound), "fb").errorMessage).toBe("fb");
    });
});
