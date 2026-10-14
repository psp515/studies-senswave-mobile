import { DevicesService } from "@/api/gen/devices/v1/devices_pb";
import { fromProtoValue, toProtoValue } from "@/api/json";
import { defineRoutes } from "../RestRoute";
import {
    asRecord,
    boolOrUndefined,
    empty,
    idResponse,
    items,
    nullableId,
    query,
    required,
    seg,
    str,
    strOrUndefined,
    structFromJson,
    timestampFromIso,
} from "../converters";

const displayDevice = (j: Record<string, unknown>) => {
    const tile = asRecord(j.tile);
    const presence = asRecord(j.presence);
    return {
        id: str(j.id),
        roomId: strOrUndefined(j.roomId),
        name: str(j.name),
        icon: str(j.icon),
        tile: {
            type: str(tile.type),
            value: toProtoValue(tile.value),
            configuration: structFromJson(tile.configuration),
        },
        presence: {
            type: str(presence.type),
            value: boolOrUndefined(presence.value),
            lastSeenAtUtc: timestampFromIso(presence.lastSeenAtUtc),
        },
        createdAtUtc: timestampFromIso(j.createdAtUtc),
        updatedAtUtc: timestampFromIso(j.updatedAtUtc),
    };
};

export const devicesRoutes = defineRoutes(DevicesService, {
    createDevice: {
        method: "POST",
        path: () => "v1/devices",
        body: (req) => ({
            homeId: req.homeId,
            roomId: nullableId(req.roomId),
            name: req.name,
            icon: req.icon,
        }),
        response: idResponse,
    },
    getDevice: {
        method: "GET",
        path: (req) => `v1/devices/${seg(req.deviceId, "deviceId")}`,
        response: (json) => {
            const j = asRecord(json);
            const tile = asRecord(j.tile);
            const presence = asRecord(j.presence);
            return {
                id: str(j.id),
                name: str(j.name),
                icon: str(j.icon),
                roomId: strOrUndefined(j.roomId),
                tile: {
                    type: str(tile.type),
                    operationId: strOrUndefined(tile.operationId),
                    displayableOperationId: strOrUndefined(tile.displayableOperationId),
                    configuration: structFromJson(tile.configuration),
                },
                presence: {
                    type: str(presence.type),
                    operationId: strOrUndefined(presence.operationId),
                },
            };
        },
    },
    updateDevice: {
        method: "PATCH",
        path: (req) => `v1/devices/${seg(req.deviceId, "deviceId")}`,
        body: (req) => ({
            roomId: nullableId(req.roomId),
            name: req.name || undefined,
            icon: req.icon || undefined,
            operationId: nullableId(req.operationId),
            displayableOperationId: nullableId(req.displayableOperationId),
            configuration: req.configuration,
            type: req.type || undefined,
            presenceOperationId: req.presenceOperationId || undefined,
            presenceType: req.presenceType || undefined,
        }),
        response: empty,
    },
    deleteDevice: {
        method: "DELETE",
        path: (req) => `v1/devices/${seg(req.deviceId, "deviceId")}`,
        response: empty,
    },
    displayDevices: {
        method: "GET",
        path: (req) =>
            `v1/devices/display${query({
                homeId: required(req.homeId, "homeId"),
                page: req.page || undefined,
                size: req.size || undefined,
            })}`,
        response: (json) => ({ items: items(json, displayDevice) }),
    },
    displayDevice: {
        method: "GET",
        path: (req) => `v1/devices/${seg(req.deviceId, "deviceId")}/display`,
        response: (json) => ({ device: displayDevice(asRecord(json)) }),
    },
    deviceTileAction: {
        method: "POST",
        path: (req) => `v1/devices/${seg(req.deviceId, "deviceId")}/tile/action`,
        body: (req) => ({ value: fromProtoValue(req.value) }),
        response: (json) => ({ device: displayDevice(asRecord(json)) }),
    },
});
