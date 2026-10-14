import { OperationsService } from "@/api/gen/devices/v1/operations_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, idResponse, items, query, seg, str, structFromJson } from "../converters";

export const operationsRoutes = defineRoutes(OperationsService, {
    createOperation: {
        method: "POST",
        path: () => "v1/devices/operations",
        body: (req) => ({
            deviceId: req.deviceId,
            name: req.name,
            type: req.type,
            configuration: req.configuration,
            topic: req.topic,
        }),
        response: idResponse,
    },
    getOperation: {
        method: "GET",
        path: (req) => `v1/devices/operations/${seg(req.operationId, "operationId")}`,
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                topic: str(j.topic),
                name: str(j.name),
                type: str(j.type),
                configuration: structFromJson(j.configuration),
            };
        },
    },
    deleteOperation: {
        method: "DELETE",
        path: (req) => `v1/devices/operations/${seg(req.operationId, "operationId")}`,
        response: empty,
    },
    displayOperations: {
        method: "GET",
        path: (req) =>
            `v1/devices/operations/display${query({
                deviceId: seg(req.deviceId, "deviceId"),
                page: req.page || undefined,
                size: req.size || undefined,
            })}`,
        response: (json) => ({
            items: items(json, (o) => ({ id: str(o.id), name: str(o.name), type: str(o.type) })),
        }),
    },
});
