import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    SharingService,
    DeleteSharingRequestSchema,
    GetSharingsRequestSchema,
    SetSharingRequestSchema,
} from "@/api/gen/devices/v1/sharing_pb";
import { deviceSharingRoutes } from "@/api/transport/rest/routes/deviceSharing";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof SharingService.method) =>
    deviceSharingRoutes.find((e) => e.key === routeKey(SharingService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("deviceSharing REST routes", () => {
    it("covers every RPC", () => {
        expect(deviceSharingRoutes.map((e) => e.key).sort()).toEqual(
            SharingService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("getSharings", () => {
        const r = route("getSharings");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetSharingsRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/sharings?deviceId=d1",
        );
        expect(
            r.response(
                {
                    items: [
                        { sharingId: null, friendEmail: "a@b.c", sharingType: "Display" },
                        { sharingId: "s1", friendEmail: "x@y.z", sharingType: "Manage" },
                    ],
                },
                200,
            ),
        ).toEqual({
            items: [
                { sharingId: undefined, friendEmail: "a@b.c", sharingType: "Display" },
                { sharingId: "s1", friendEmail: "x@y.z", sharingType: "Manage" },
            ],
        });
    });

    it("setSharing", () => {
        const r = route("setSharing");
        const req = create(SetSharingRequestSchema, {
            deviceId: "d1",
            sharingType: "Display",
            friendEmail: "a@b.c",
        });
        expect(r.method).toBe("PUT");
        expect(r.path(req as never)).toBe("v1/devices/sharings");
        expect(plain(r.body!(req as never))).toEqual({
            deviceId: "d1",
            sharingType: "Display",
            friendEmail: "a@b.c",
        });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteSharing", () => {
        const r = route("deleteSharing");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteSharingRequestSchema, { deviceSharingId: "s1" }) as never)).toBe(
            "v1/devices/sharings/s1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("rejects empty path ids", () => {
        expect(() =>
            route("deleteSharing").path(create(DeleteSharingRequestSchema) as never),
        ).toThrow(expect.objectContaining({ code: Code.InvalidArgument }));
    });
});

describe("deviceSharing query parameter encoding", () => {
    it("getSharings encodes the deviceId once and rejects empty", () => {
        const r = route("getSharings");
        expect(r.path(create(GetSharingsRequestSchema, { deviceId: "a b" }) as never)).toBe(
            "v1/devices/sharings?deviceId=a%20b",
        );
        expect(() => r.path(create(GetSharingsRequestSchema) as never)).toThrow(
            expect.objectContaining({ code: Code.InvalidArgument }),
        );
    });
});
