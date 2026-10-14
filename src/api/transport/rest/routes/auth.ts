import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, num, query, str } from "../converters";

const accessToken = (json: unknown) => {
    const j = asRecord(json);
    return {
        tokenType: str(j.tokenType),
        accessToken: str(j.accessToken),
        expiresIn: BigInt(num(j.expiresIn)),
        refreshToken: str(j.refreshToken),
    };
};

export const authRoutes = defineRoutes(AuthService, {
    register: {
        method: "POST",
        path: () => "v1/auth/register",
        body: (req) => ({ email: req.email, password: req.password }),
        response: empty,
    },
    login: {
        method: "POST",
        path: () => "v1/auth/login",
        body: (req) => ({
            email: req.email,
            password: req.password,
            twoFactorCode: req.twoFactorCode,
            twoFactorRecoveryCode: req.twoFactorRecoveryCode,
        }),
        response: accessToken,
    },
    refresh: {
        method: "POST",
        path: () => "v1/auth/refresh",
        body: (req) => ({ refreshToken: req.refreshToken }),
        response: accessToken,
    },
    confirmEmail: {
        method: "POST",
        path: (req) =>
            `v1/auth/confirmEmail${query({
                userId: req.userId,
                code: req.code,
                changedEmail: req.changedEmail,
            })}`,
        response: empty,
    },
    resendConfirmationEmail: {
        method: "POST",
        path: () => "v1/auth/resendConfirmationEmail",
        body: (req) => ({ email: req.email }),
        response: empty,
    },
    forgotPassword: {
        method: "POST",
        path: () => "v1/auth/forgotPassword",
        body: (req) => ({ email: req.email }),
        response: empty,
    },
    resetPassword: {
        method: "POST",
        path: () => "v1/auth/resetPassword",
        body: (req) => ({
            email: req.email,
            resetCode: req.resetCode,
            newPassword: req.newPassword,
        }),
        response: empty,
    },
});
