import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    DashboardsService,
    CreateDashboardRequestSchema,
    DeleteDashboardRequestSchema,
    DeleteDashboardWidgetRequestSchema,
    DisplayDashboardRequestSchema,
    DisplayDashboardsRequestSchema,
    GetDashboardRequestSchema,
    SetWidgetOnDashboardRequestSchema,
    UpdateDashboardRequestSchema,
} from "@/api/gen/devices/v1/dashboards_pb";
import { dashboardsRoutes } from "@/api/transport/rest/routes/dashboards";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof DashboardsService.method) =>
    dashboardsRoutes.find((e) => e.key === routeKey(DashboardsService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("dashboards REST routes", () => {
    it("covers every RPC", () => {
        expect(dashboardsRoutes.map((e) => e.key).sort()).toEqual(
            DashboardsService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("createDashboard", () => {
        const r = route("createDashboard");
        const req = create(CreateDashboardRequestSchema, {
            deviceId: "d1",
            name: "n",
            icon: "i",
            configuration: { rows: 2 },
        });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/devices/dashboards");
        expect(plain(r.body!(req as never))).toEqual({
            deviceId: "d1",
            name: "n",
            icon: "i",
            configuration: { rows: 2 },
        });
        expect(r.response({ id: "x" }, 201)).toEqual({ id: "x" });
    });

    it("getDashboard", () => {
        const r = route("getDashboard");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetDashboardRequestSchema, { dashboardId: "b1" }) as never)).toBe(
            "v1/devices/dashboards/b1",
        );
        expect(
            r.response({ id: "b1", name: "n", icon: "i", type: "Grid", configuration: null }, 200),
        ).toEqual({ id: "b1", name: "n", icon: "i", type: "Grid", configuration: {} });
        expect(
            r.response(
                { id: "b1", name: "n", icon: "i", type: "Grid", configuration: { a: 1 } },
                200,
            ),
        ).toMatchObject({ configuration: { a: 1 } });
    });

    it("updateDashboard drops empty name/icon", () => {
        const r = route("updateDashboard");
        const mk = (init: object) =>
            create(UpdateDashboardRequestSchema, { dashboardId: "b1", ...init }) as never;
        expect(r.method).toBe("PATCH");
        expect(r.path(mk({}))).toBe("v1/devices/dashboards/b1");
        expect(plain(r.body!(mk({})))).toEqual({});
        expect(plain(r.body!(mk({ name: "n" })))).toEqual({ name: "n" });
        expect(plain(r.body!(mk({ name: "n", icon: "i" })))).toEqual({ name: "n", icon: "i" });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteDashboard", () => {
        const r = route("deleteDashboard");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteDashboardRequestSchema, { dashboardId: "b1" }) as never)).toBe(
            "v1/devices/dashboards/b1",
        );
    });

    it("displayDashboards", () => {
        const r = route("displayDashboards");
        expect(r.method).toBe("GET");
        expect(r.path(create(DisplayDashboardsRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/dashboards/display?deviceId=d1",
        );
        expect(
            r.response({ items: [{ id: "b1", name: "n", icon: "i", type: "Grid" }] }, 200),
        ).toEqual({ items: [{ id: "b1", name: "n", icon: "i", type: "Grid" }] });
    });

    it("displayDashboard passes configuration through", () => {
        const r = route("displayDashboard");
        expect(r.path(create(DisplayDashboardRequestSchema, { dashboardId: "b1" }) as never)).toBe(
            "v1/devices/dashboards/b1/display",
        );
        const cfg = { rows: 2, columns: 3, positionedWidgets: [{ id: "w" }] };
        expect(r.response({ type: "Grid", configuration: cfg }, 200)).toEqual({
            type: "Grid",
            configuration: cfg,
        });
        expect(r.response({ type: "Grid", configuration: null }, 200)).toEqual({
            type: "Grid",
            configuration: {},
        });
    });

    it("setWidgetOnDashboard", () => {
        const r = route("setWidgetOnDashboard");
        const req = create(SetWidgetOnDashboardRequestSchema, {
            dashboardId: "b1",
            widgetId: "w1",
            row: 1,
            rowSpan: 2,
            column: 3,
            columnSpan: 4,
        });
        expect(r.method).toBe("PUT");
        expect(r.path(req as never)).toBe("v1/devices/dashboards/b1/widgets");
        expect(plain(r.body!(req as never))).toEqual({
            widgetId: "w1",
            row: 1,
            rowSpan: 2,
            column: 3,
            columnSpan: 4,
        });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteDashboardWidget", () => {
        const r = route("deleteDashboardWidget");
        expect(r.method).toBe("DELETE");
        expect(
            r.path(
                create(DeleteDashboardWidgetRequestSchema, {
                    dashboardId: "b1",
                    widgetId: "w1",
                }) as never,
            ),
        ).toBe("v1/devices/dashboards/b1/widgets/w1");
    });

    it("rejects empty path ids", () => {
        expect(() =>
            route("getDashboard").path(create(GetDashboardRequestSchema) as never),
        ).toThrow(expect.objectContaining({ code: Code.InvalidArgument }));
    });
});
