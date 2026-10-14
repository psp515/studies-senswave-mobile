import { DashboardsService } from "@/api/gen/devices/v1/dashboards_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, idResponse, items, query, seg, str, structFromJson } from "../converters";

export const dashboardsRoutes = defineRoutes(DashboardsService, {
    createDashboard: {
        method: "POST",
        path: () => "v1/devices/dashboards",
        body: (req) => ({
            deviceId: req.deviceId,
            name: req.name,
            icon: req.icon,
            configuration: req.configuration,
        }),
        response: idResponse,
    },
    getDashboard: {
        method: "GET",
        path: (req) => `v1/devices/dashboards/${seg(req.dashboardId, "dashboardId")}`,
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                name: str(j.name),
                icon: str(j.icon),
                type: str(j.type),
                configuration: structFromJson(j.configuration),
            };
        },
    },
    updateDashboard: {
        method: "PATCH",
        path: (req) => `v1/devices/dashboards/${seg(req.dashboardId, "dashboardId")}`,
        body: (req) => ({ name: req.name || undefined, icon: req.icon || undefined }),
        response: empty,
    },
    deleteDashboard: {
        method: "DELETE",
        path: (req) => `v1/devices/dashboards/${seg(req.dashboardId, "dashboardId")}`,
        response: empty,
    },
    displayDashboards: {
        method: "GET",
        path: (req) =>
            `v1/devices/dashboards/display${query({ deviceId: seg(req.deviceId, "deviceId") })}`,
        response: (json) => ({
            items: items(json, (d) => ({
                id: str(d.id),
                name: str(d.name),
                icon: str(d.icon),
                type: str(d.type),
            })),
        }),
    },
    displayDashboard: {
        method: "GET",
        path: (req) => `v1/devices/dashboards/${seg(req.dashboardId, "dashboardId")}/display`,
        response: (json) => {
            const j = asRecord(json);
            return { type: str(j.type), configuration: structFromJson(j.configuration) };
        },
    },
    setWidgetOnDashboard: {
        method: "PUT",
        path: (req) => `v1/devices/dashboards/${seg(req.dashboardId, "dashboardId")}/widgets`,
        body: (req) => ({
            widgetId: req.widgetId,
            row: req.row,
            rowSpan: req.rowSpan,
            column: req.column,
            columnSpan: req.columnSpan,
        }),
        response: empty,
    },
    deleteDashboardWidget: {
        method: "DELETE",
        path: (req) =>
            `v1/devices/dashboards/${seg(req.dashboardId, "dashboardId")}/widgets/${seg(req.widgetId, "widgetId")}`,
        response: empty,
    },
});
