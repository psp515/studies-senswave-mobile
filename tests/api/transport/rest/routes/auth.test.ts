import { create } from "@bufbuild/protobuf";
import {
    AuthService,
    ConfirmEmailRequestSchema,
    LoginRequestSchema,
    ResetPasswordRequestSchema,
} from "@/api/gen/users/v1/auth_pb";
import { authRoutes } from "@/api/transport/rest/routes/auth";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof AuthService.method) =>
    authRoutes.find((e) => e.key === routeKey(AuthService.method[name]))!.route;

describe("auth REST routes", () => {
    it("covers every RPC", () => {
        expect(authRoutes).toHaveLength(AuthService.methods.length);
    });

    it("login", () => {
        const r = route("login");
        const req = create(LoginRequestSchema, { email: "a@b", password: "p" });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/auth/login");
        expect(r.body!(req as never)).toEqual({ email: "a@b", password: "p" });
        expect(
            r.response(
                { tokenType: "Bearer", accessToken: "a", expiresIn: 3600, refreshToken: "r" },
                200,
            ),
        ).toEqual({
            tokenType: "Bearer",
            accessToken: "a",
            expiresIn: BigInt(3600),
            refreshToken: "r",
        });
    });

    it("confirmEmail uses query string", () => {
        const r = route("confirmEmail");
        const req = create(ConfirmEmailRequestSchema, { userId: "u 1", code: "c&d" });
        expect(r.path(req as never)).toBe("v1/auth/confirmEmail?userId=u%201&code=c%26d");
        expect(r.body).toBeUndefined();
        const withEmail = create(ConfirmEmailRequestSchema, {
            userId: "u",
            code: "c",
            changedEmail: "x@y",
        });
        expect(r.path(withEmail as never)).toBe(
            "v1/auth/confirmEmail?userId=u&code=c&changedEmail=x%40y",
        );
    });

    it("resetPassword body", () => {
        const r = route("resetPassword");
        const req = create(ResetPasswordRequestSchema, {
            email: "e",
            resetCode: "rc",
            newPassword: "np",
        });
        expect(r.body!(req as never)).toEqual({ email: "e", resetCode: "rc", newPassword: "np" });
    });

    it("refresh, register, forgot, resend", () => {
        expect(route("refresh").path({} as never)).toBe("v1/auth/refresh");
        expect(route("register").path({} as never)).toBe("v1/auth/register");
        expect(route("forgotPassword").path({} as never)).toBe("v1/auth/forgotPassword");
        expect(route("resendConfirmationEmail").path({} as never)).toBe(
            "v1/auth/resendConfirmationEmail",
        );
    });
});
