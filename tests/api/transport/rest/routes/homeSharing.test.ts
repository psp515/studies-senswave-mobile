import { create } from "@bufbuild/protobuf";
import {
    SharingService,
    AcceptSharingRequestSchema,
    CreateSharingRequestSchema,
    DeleteSharingRequestSchema,
    GetSharingsRequestSchema,
    LeaveSharingRequestSchema,
} from "@/api/gen/homes/v1/sharing_pb";
import { homeSharingRoutes } from "@/api/transport/rest/routes/homeSharing";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof SharingService.method) =>
    homeSharingRoutes.find((e) => e.key === routeKey(SharingService.method[name]))!.route;

describe("homeSharing REST routes", () => {
    it("covers every RPC", () => {
        expect(homeSharingRoutes.map((e) => e.key).sort()).toEqual(
            SharingService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("getSharings", () => {
        const r = route("getSharings");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetSharingsRequestSchema, { homeId: "h1" }) as never)).toBe(
            "v1/homes/sharings?homeId=h1",
        );
        expect(
            r.response(
                { items: [{ sharingId: "s1", friendEmail: "a@b", sharingType: "Display" }] },
                200,
            ),
        ).toEqual({ items: [{ sharingId: "s1", friendEmail: "a@b", sharingType: "Display" }] });
    });

    it("createSharing", () => {
        const r = route("createSharing");
        const req = create(CreateSharingRequestSchema, {
            homeId: "h1",
            friendEmail: "a@b",
            sharingType: "Manage",
        });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/homes/sharings");
        expect(r.body!(req as never)).toEqual({
            homeId: "h1",
            friendEmail: "a@b",
            sharingType: "Manage",
        });
        const out = r.response(
            {
                invitationId: "i1",
                password: "pw",
                expiresAtUtc: "2026-01-02T00:00:00Z",
                createdUtc: "2026-01-01T00:00:00Z",
            },
            201,
        ) as {
            invitationId: string;
            password: string;
            expiresAtUtc: { seconds: bigint };
            createdUtc: { seconds: bigint };
        };
        expect(out.invitationId).toBe("i1");
        expect(out.password).toBe("pw");
        expect(out.createdUtc.seconds).toBe(BigInt(Date.UTC(2026, 0, 1) / 1000));
        expect(out.expiresAtUtc.seconds).toBe(BigInt(Date.UTC(2026, 0, 2) / 1000));
    });

    it("acceptSharing", () => {
        const r = route("acceptSharing");
        const req = create(AcceptSharingRequestSchema, { password: "pw" });
        expect(r.method).toBe("PUT");
        expect(r.path(req as never)).toBe("v1/homes/sharings");
        expect(r.body!(req as never)).toEqual({ password: "pw" });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteSharing", () => {
        const r = route("deleteSharing");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteSharingRequestSchema, { homeSharingId: "s1" }) as never)).toBe(
            "v1/homes/sharings/s1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("leaveSharing", () => {
        const r = route("leaveSharing");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(LeaveSharingRequestSchema, { homeId: "h1" }) as never)).toBe(
            "v1/homes/sharings/leave/h1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });
});
