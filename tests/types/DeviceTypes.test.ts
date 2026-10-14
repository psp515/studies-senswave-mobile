import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { DisplayDeviceDtoSchema, GetDeviceResponseSchema } from "@/api/gen/devices/v1/devices_pb";
import { GetOperationResponseSchema } from "@/api/gen/devices/v1/operations_pb";
import {
    DisplayWidgetsResponseSchema,
    GetWidgetResponseSchema,
} from "@/api/gen/devices/v1/widgets_pb";
import { toProtoValue } from "@/api/json";
import {
    toDevice,
    toDeviceDetails,
    toOperationDto,
    toOperationGroups,
    toWidgetDto,
} from "@/types/DeviceTypes";

const created = new Date("2026-01-02T03:04:05.000Z");
const updated = new Date("2026-02-03T04:05:06.000Z");

describe("toDevice", () => {
    it("maps a full dto", () => {
        const device = toDevice(
            create(DisplayDeviceDtoSchema, {
                id: "d1",
                roomId: "r1",
                name: "Lamp",
                icon: "bulb",
                tile: { type: "Switch", value: toProtoValue(true), configuration: { a: 1 } },
                presence: {
                    type: "Default",
                    value: true,
                    lastSeenAtUtc: timestampFromDate(created),
                },
                createdAtUtc: timestampFromDate(created),
                updatedAtUtc: timestampFromDate(updated),
            }),
        );
        expect(device).toEqual({
            id: "d1",
            roomId: "r1",
            name: "Lamp",
            icon: "bulb",
            tile: { type: "Switch", value: true, configuration: { a: 1 } },
            presence: {
                type: "Default",
                value: true,
                lastSeenAtUtc: "2026-01-02T03:04:05.000Z",
            },
            createdAtUtc: "2026-01-02T03:04:05.000Z",
            updatedAtUtc: "2026-02-03T04:05:06.000Z",
        });
    });

    it("handles unset optionals", () => {
        const device = toDevice(create(DisplayDeviceDtoSchema, { id: "d1", name: "X" }));
        expect(device.roomId).toBeUndefined();
        expect(device.tile.value).toBeNull();
        expect(device.tile.configuration).toEqual({});
        expect(device.presence?.value ?? null).toBeNull();
        expect(device.presence?.lastSeenAtUtc ?? null).toBeNull();
        expect(device.createdAtUtc).toBe("");
        expect(device.updatedAtUtc).toBe("");
    });

    it.each([[false], [12.5], ["text"], [null]])("maps tile value %p", (v) => {
        const device = toDevice(
            create(DisplayDeviceDtoSchema, {
                id: "d",
                tile: { type: "Display", value: toProtoValue(v) },
            }),
        );
        expect(device.tile.value).toEqual(v);
    });
});

describe("toDeviceDetails", () => {
    it("maps details with null value and empty timestamps", () => {
        const device = toDeviceDetails(
            create(GetDeviceResponseSchema, {
                id: "d1",
                name: "Lamp",
                icon: "bulb",
                roomId: "r1",
                tile: {
                    type: "Switch",
                    operationId: "o1",
                    displayableOperationId: "o2",
                    configuration: { k: "v" },
                },
                presence: { type: "BooleanOperation", operationId: "o3" },
            }),
        );
        expect(device).toEqual({
            id: "d1",
            name: "Lamp",
            icon: "bulb",
            roomId: "r1",
            tile: {
                type: "Switch",
                operationId: "o1",
                displayableOperationId: "o2",
                value: null,
                configuration: { k: "v" },
            },
            presence: { type: "BooleanOperation", operationId: "o3" },
            createdAtUtc: "",
            updatedAtUtc: "",
        });
    });
});

describe("operation and widget mappers", () => {
    it("maps an operation", () => {
        expect(
            toOperationDto(
                create(GetOperationResponseSchema, {
                    id: "o1",
                    topic: "t",
                    name: "Op",
                    type: "Number",
                    configuration: { x: 1 },
                }),
            ),
        ).toEqual({ id: "o1", topic: "t", name: "Op", type: "Number", configuration: { x: 1 } });
    });

    it("maps a widget with empty configuration default", () => {
        expect(
            toWidgetDto(
                create(GetWidgetResponseSchema, {
                    id: "w1",
                    deviceId: "d1",
                    operationId: "o1",
                    name: "W",
                    type: "Slider",
                    enabled: true,
                }),
            ),
        ).toEqual({
            id: "w1",
            deviceId: "d1",
            operationId: "o1",
            name: "W",
            type: "Slider",
            enabled: true,
            configuration: {},
        });
    });

    it("nests widgets under operations", () => {
        const groups = toOperationGroups(
            create(DisplayWidgetsResponseSchema, {
                items: [
                    {
                        operation: { id: "o1", name: "Op", type: "Boolean" },
                        widgets: [{ id: "w1", name: "W", type: "Switch", enabled: true }],
                    },
                ],
            }),
        );
        expect(groups).toEqual([
            {
                operation: { id: "o1", name: "Op", type: "Boolean" },
                widgets: [{ id: "w1", name: "W", type: "Switch", enabled: true }],
            },
        ]);
    });
});
