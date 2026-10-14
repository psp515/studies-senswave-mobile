import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { ValueSchema, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
    DevicesService,
    CreateDeviceRequestSchema,
    DeleteDeviceRequestSchema,
    DeviceTileActionRequestSchema,
    DisplayDeviceRequestSchema,
    DisplayDevicesRequestSchema,
    GetDeviceRequestSchema,
    UpdateDeviceRequestSchema,
} from "@/api/gen/devices/v1/devices_pb";
import { devicesRoutes } from "@/api/transport/rest/routes/devices";
import { routeKey } from "@/api/transport/rest/RestRoute";
import { toProtoValue } from "@/api/json";

const route = (name: keyof typeof DevicesService.method) =>
    devicesRoutes.find((e) => e.key === routeKey(DevicesService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

type Out = { device: Record<string, any> };

const dtoJson = {
    id: "d1",
    roomId: null,
    name: "Lamp",
    icon: "bulb",
    tile: { type: "Switch", value: true, configuration: null },
    presence: { type: "Default", value: null, lastSeenAtUtc: "2026-01-02T03:04:05Z" },
    createdAtUtc: "2026-01-01T00:00:00Z",
    updatedAtUtc: "2026-01-01T00:00:00",
};

describe("devices REST routes", () => {
    it("covers every RPC", () => {
        expect(devicesRoutes.map((e) => e.key).sort()).toEqual(
            DevicesService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("createDevice body omits unset roomId and nulls empty roomId", () => {
        const r = route("createDevice");
        expect(r.method).toBe("POST");
        expect(r.path({} as never)).toBe("v1/devices");
        const base = { homeId: "h1", name: "n", icon: "i" };
        const body = (init: object) =>
            plain(r.body!(create(CreateDeviceRequestSchema, { ...base, ...init }) as never));
        expect(body({})).toEqual(base);
        expect(body({ roomId: "" })).toEqual({ ...base, roomId: null });
        expect(body({ roomId: "r1" })).toEqual({ ...base, roomId: "r1" });
        expect(r.response({ id: "d9" }, 201)).toEqual({ id: "d9" });
    });

    it("getDevice path and response", () => {
        const r = route("getDevice");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetDeviceRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/d1",
        );
        expect(
            r.response(
                {
                    id: "d1",
                    name: "n",
                    icon: "i",
                    roomId: null,
                    tile: {
                        type: "Switch",
                        operationId: null,
                        displayableOperationId: "o2",
                        configuration: null,
                    },
                    presence: { type: "Default", operationId: null },
                },
                200,
            ),
        ).toEqual({
            id: "d1",
            name: "n",
            icon: "i",
            roomId: undefined,
            tile: {
                type: "Switch",
                operationId: undefined,
                displayableOperationId: "o2",
                configuration: {},
            },
            presence: { type: "Default", operationId: undefined },
        });
    });

    it("updateDevice body rules", () => {
        const r = route("updateDevice");
        expect(r.method).toBe("PATCH");
        expect(r.path(create(UpdateDeviceRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/d1",
        );
        const body = (init: object) =>
            plain(r.body!(create(UpdateDeviceRequestSchema, { deviceId: "d1", ...init }) as never));
        expect(body({})).toEqual({});
        expect(body({ roomId: "" })).toEqual({ roomId: null });
        expect(body({ roomId: "r1" })).toEqual({ roomId: "r1" });
        expect(body({ operationId: "" })).toEqual({ operationId: null });
        expect(body({ displayableOperationId: "" })).toEqual({ displayableOperationId: null });
        expect(body({ operationId: "o1", displayableOperationId: "o2" })).toEqual({
            operationId: "o1",
            displayableOperationId: "o2",
        });
        expect(body({ name: "n", icon: "i" })).toEqual({ name: "n", icon: "i" });
        expect(body({ type: "Switch", presenceOperationId: "p", presenceType: "Default" })).toEqual(
            { type: "Switch", presenceOperationId: "p", presenceType: "Default" },
        );
        expect(body({ configuration: { a: 1 } })).toEqual({ configuration: { a: 1 } });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteDevice", () => {
        const r = route("deleteDevice");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteDeviceRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/d1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("displayDevices path and response", () => {
        const r = route("displayDevices");
        expect(r.method).toBe("GET");
        expect(
            r.path(
                create(DisplayDevicesRequestSchema, { homeId: "h1", page: 0, size: 0 }) as never,
            ),
        ).toBe("v1/devices/display?homeId=h1");
        expect(
            r.path(
                create(DisplayDevicesRequestSchema, { homeId: "h1", page: 2, size: 5 }) as never,
            ),
        ).toBe("v1/devices/display?homeId=h1&page=2&size=5");
        const out = r.response({ items: [dtoJson] }, 200) as { items: Record<string, any>[] };
        expect(out.items).toHaveLength(1);
        expect(out.items[0].id).toBe("d1");
    });

    it("displayDevice wraps the unwrapped dto as { device }", () => {
        const r = route("displayDevice");
        expect(r.path(create(DisplayDeviceRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/d1/display",
        );
        const out = r.response(dtoJson, 200) as Out;
        expect(out.device.roomId).toBeUndefined();
        expect(out.device.tile.configuration).toEqual({});
        expect(out.device.tile.value.kind).toEqual({ case: "boolValue", value: true });
        expect(out.device.presence.value).toBeUndefined();
        expect(out.device.presence.lastSeenAtUtc).toEqual(
            timestampFromDate(new Date("2026-01-02T03:04:05Z")),
        );
        expect(out.device.updatedAtUtc).toEqual(
            timestampFromDate(new Date("2026-01-01T00:00:00Z")),
        );
    });

    it("tile null value maps to nullValue", () => {
        const out = route("displayDevice").response(
            {
                ...dtoJson,
                roomId: "r1",
                tile: { type: "Display", value: null, configuration: { a: 1 } },
            },
            200,
        ) as Out;
        expect(out.device.roomId).toBe("r1");
        expect(out.device.tile.value.kind.case).toBe("nullValue");
        expect(out.device.tile.configuration).toEqual({ a: 1 });
    });

    it("deviceTileAction body and { device } response", () => {
        const r = route("deviceTileAction");
        expect(r.method).toBe("POST");
        const req = create(DeviceTileActionRequestSchema, {
            deviceId: "d1",
            value: toProtoValue(true),
        });
        expect(r.path(req as never)).toBe("v1/devices/d1/tile/action");
        expect(plain(r.body!(req as never))).toEqual({ value: true });
        expect(
            plain(r.body!(create(DeviceTileActionRequestSchema, { deviceId: "d1" }) as never)),
        ).toEqual({ value: null });
        expect(
            plain(
                r.body!(
                    create(DeviceTileActionRequestSchema, {
                        deviceId: "d1",
                        value: create(ValueSchema, { kind: { case: "stringValue", value: "x" } }),
                    }) as never,
                ),
            ),
        ).toEqual({ value: "x" });
        expect((r.response(dtoJson, 200) as Out).device.id).toBe("d1");
    });

    it("rejects empty path ids", () => {
        expect(() => route("getDevice").path(create(GetDeviceRequestSchema) as never)).toThrow(
            expect.objectContaining({ code: Code.InvalidArgument }),
        );
    });
});

describe("devices query parameter encoding", () => {
    it("displayDevices encodes the homeId once and rejects empty", () => {
        const r = route("displayDevices");
        expect(r.path(create(DisplayDevicesRequestSchema, { homeId: "a b" }) as never)).toBe(
            "v1/devices/display?homeId=a%20b",
        );
        expect(() => r.path(create(DisplayDevicesRequestSchema) as never)).toThrow(
            expect.objectContaining({ code: Code.InvalidArgument }),
        );
    });
});
