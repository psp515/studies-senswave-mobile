import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    WidgetsService,
    ActionRequestSchema,
    CreateWidgetRequestSchema,
    DeleteWidgetRequestSchema,
    DisplayWidgetsRequestSchema,
    GetWidgetRequestSchema,
    StateRequestSchema,
} from "@/api/gen/devices/v1/widgets_pb";
import { widgetsRoutes } from "@/api/transport/rest/routes/widgets";
import { routeKey } from "@/api/transport/rest/RestRoute";
import { toProtoValue } from "@/api/json";

const route = (name: keyof typeof WidgetsService.method) =>
    widgetsRoutes.find((e) => e.key === routeKey(WidgetsService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("widgets REST routes", () => {
    it("covers every RPC", () => {
        expect(widgetsRoutes.map((e) => e.key).sort()).toEqual(
            WidgetsService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("createWidget", () => {
        const r = route("createWidget");
        const req = create(CreateWidgetRequestSchema, {
            operationId: "o1",
            name: "n",
            type: "Button",
            configuration: { value: "x" },
        });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/devices/widgets");
        expect(plain(r.body!(req as never))).toEqual({
            operationId: "o1",
            name: "n",
            type: "Button",
            configuration: { value: "x" },
        });
        expect(r.response({ id: "w1" }, 201)).toEqual({ id: "w1" });
    });

    it("getWidget", () => {
        const r = route("getWidget");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetWidgetRequestSchema, { widgetId: "w1" }) as never)).toBe(
            "v1/devices/widgets/w1",
        );
        expect(
            r.response(
                {
                    id: "w1",
                    deviceId: "d1",
                    operationId: "o1",
                    name: "n",
                    type: "Switch",
                    enabled: true,
                    configuration: null,
                },
                200,
            ),
        ).toEqual({
            id: "w1",
            deviceId: "d1",
            operationId: "o1",
            name: "n",
            type: "Switch",
            enabled: true,
            configuration: {},
        });
    });

    it("deleteWidget", () => {
        const r = route("deleteWidget");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteWidgetRequestSchema, { widgetId: "w1" }) as never)).toBe(
            "v1/devices/widgets/w1",
        );
    });

    it("displayWidgets nests operation and widgets", () => {
        const r = route("displayWidgets");
        expect(r.method).toBe("GET");
        expect(r.path(create(DisplayWidgetsRequestSchema, { deviceId: "d1" }) as never)).toBe(
            "v1/devices/widgets/display?deviceId=d1",
        );
        expect(
            r.response(
                {
                    items: [
                        {
                            operation: { id: "o1", name: "On", type: "Boolean" },
                            widgets: [{ id: "w1", name: "Sw", type: "Switch", enabled: true }],
                        },
                    ],
                },
                200,
            ),
        ).toEqual({
            items: [
                {
                    operation: { id: "o1", name: "On", type: "Boolean" },
                    widgets: [{ id: "w1", name: "Sw", type: "Switch", enabled: true }],
                },
            ],
        });
    });

    it.each([["x"], [1.5], [true]])("action body carries %p", (value) => {
        const r = route("action");
        const req = create(ActionRequestSchema, { widgetId: "w1", value: toProtoValue(value) });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/devices/widgets/w1/action");
        expect(plain(r.body!(req as never))).toEqual({ value });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("action body is null when value unset", () => {
        const req = create(ActionRequestSchema, { widgetId: "w1" });
        expect(plain(route("action").body!(req as never))).toEqual({ value: null });
    });

    it("state", () => {
        const r = route("state");
        const req = create(StateRequestSchema, { widgetId: "w1", enabled: false });
        expect(r.method).toBe("PUT");
        expect(r.path(req as never)).toBe("v1/devices/widgets/w1/state");
        expect(plain(r.body!(req as never))).toEqual({ enabled: false });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("rejects empty path ids", () => {
        expect(() => route("getWidget").path(create(GetWidgetRequestSchema) as never)).toThrow(
            expect.objectContaining({ code: Code.InvalidArgument }),
        );
    });
});
