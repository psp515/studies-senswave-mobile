import { WidgetsService } from "@/api/gen/devices/v1/widgets_pb";
import { fromProtoValue } from "@/api/json";
import { defineRoutes } from "../RestRoute";
import {
    asRecord,
    bool,
    empty,
    idResponse,
    items,
    query,
    required,
    seg,
    str,
    structFromJson,
} from "../converters";

export const widgetsRoutes = defineRoutes(WidgetsService, {
    createWidget: {
        method: "POST",
        path: () => "v1/devices/widgets",
        body: (req) => ({
            operationId: req.operationId,
            name: req.name,
            type: req.type,
            configuration: req.configuration,
        }),
        response: idResponse,
    },
    getWidget: {
        method: "GET",
        path: (req) => `v1/devices/widgets/${seg(req.widgetId, "widgetId")}`,
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                deviceId: str(j.deviceId),
                operationId: str(j.operationId),
                name: str(j.name),
                type: str(j.type),
                enabled: bool(j.enabled),
                configuration: structFromJson(j.configuration),
            };
        },
    },
    deleteWidget: {
        method: "DELETE",
        path: (req) => `v1/devices/widgets/${seg(req.widgetId, "widgetId")}`,
        response: empty,
    },
    displayWidgets: {
        method: "GET",
        path: (req) =>
            `v1/devices/widgets/display${query({ deviceId: required(req.deviceId, "deviceId") })}`,
        response: (json) => ({
            items: items(json, (g) => {
                const op = asRecord(g.operation);
                return {
                    operation: { id: str(op.id), name: str(op.name), type: str(op.type) },
                    widgets: items(g.widgets, (w) => ({
                        id: str(w.id),
                        name: str(w.name),
                        type: str(w.type),
                        enabled: bool(w.enabled),
                    })),
                };
            }),
        }),
    },
    action: {
        method: "POST",
        path: (req) => `v1/devices/widgets/${seg(req.widgetId, "widgetId")}/action`,
        body: (req) => ({ value: fromProtoValue(req.value) }),
        response: empty,
    },
    state: {
        method: "PUT",
        path: (req) => `v1/devices/widgets/${seg(req.widgetId, "widgetId")}/state`,
        body: (req) => ({ enabled: req.enabled }),
        response: empty,
    },
});
