import { UsersService } from "@/api/gen/users/v1/users_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, bool, empty, str } from "../converters";

export const usersRoutes = defineRoutes(UsersService, {
    getUser: {
        method: "GET",
        path: () => "v1/users",
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                email: str(j.email),
                theme: str(j.theme),
                language: str(j.language),
                hasActiveConsent: bool(j.hasActiveConsent),
            };
        },
    },
    updateSettings: {
        method: "PATCH",
        path: () => "v1/users/settings",
        body: (req) => ({
            theme: req.theme || undefined,
            language: req.language || undefined,
        }),
        response: empty,
    },
    createConsents: {
        method: "POST",
        path: () => "v1/users/consents",
        body: () => ({}),
        response: empty,
    },
    deleteAccount: {
        method: "DELETE",
        path: () => "v1/users/account",
        response: empty,
    },
});
