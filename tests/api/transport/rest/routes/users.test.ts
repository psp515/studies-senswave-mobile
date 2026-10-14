import { create } from "@bufbuild/protobuf";
import { UsersService, UpdateSettingsRequestSchema } from "@/api/gen/users/v1/users_pb";
import { usersRoutes } from "@/api/transport/rest/routes/users";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof UsersService.method) =>
    usersRoutes.find((e) => e.key === routeKey(UsersService.method[name]))!.route;

describe("users REST routes", () => {
    it("covers every RPC", () => {
        expect(usersRoutes.map((e) => e.key).sort()).toEqual(
            UsersService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("getUser", () => {
        const r = route("getUser");
        expect(r.method).toBe("GET");
        expect(r.path({} as never)).toBe("v1/users");
        const out = r.response(
            { id: "u1", email: "a@b", theme: "dark", language: "en", hasActiveConsent: true },
            200,
        );
        expect(out).toEqual({
            id: "u1",
            email: "a@b",
            theme: "dark",
            language: "en",
            hasActiveConsent: true,
        });
    });

    it("updateSettings sends only provided fields", () => {
        const r = route("updateSettings");
        expect(r.method).toBe("PATCH");
        expect(r.path({} as never)).toBe("v1/users/settings");
        expect(r.body!(create(UpdateSettingsRequestSchema, { theme: "light" }) as never)).toEqual({
            theme: "light",
        });
        expect(r.body!(create(UpdateSettingsRequestSchema, { language: "pl" }) as never)).toEqual({
            language: "pl",
        });
    });

    it("createConsents and deleteAccount", () => {
        expect(route("createConsents").method).toBe("POST");
        expect(route("createConsents").path({} as never)).toBe("v1/users/consents");
        expect(route("deleteAccount").method).toBe("DELETE");
        expect(route("deleteAccount").path({} as never)).toBe("v1/users/account");
        expect(route("deleteAccount").response(undefined, 204)).toEqual({});
    });
});
