import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    AutomationsService,
    AutomationStateRequestSchema,
    ConditionConnector,
    ConditionType,
    CreateAutomationRequestSchema,
    DeleteAutomationRequestSchema,
    DeleteConditionRequestSchema,
    DeleteResultRequestSchema,
    DisplayAutomationsRequestSchema,
    GetAutomationRequestSchema,
    PutConditionToAutomationRequestSchema,
    PutResultToAutomationRequestSchema,
    UpdateAutomationRequestSchema,
} from "@/api/gen/automations/v1/automations_pb";
import { automationsRoutes } from "@/api/transport/rest/routes/automations";
import { routeKey } from "@/api/transport/rest/RestRoute";
import { toProtoValue } from "@/api/json";

const route = (name: keyof typeof AutomationsService.method) =>
    automationsRoutes.find((e) => e.key === routeKey(AutomationsService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

const modelJson = {
    id: "a1",
    homeId: "h1",
    name: "Night",
    icon: "moon",
    conditionConnector: "And",
    isEnabled: true,
    conditions: [
        {
            id: "c1",
            operationId: "o1",
            operationName: "Lamp",
            conditionType: "NumberCondition",
            conditionConfiguration: { minValue: 1, maxValue: 5 },
        },
        {
            id: "c2",
            operationId: "o2",
            operationName: "X",
            conditionType: "Empty",
            conditionConfiguration: null,
        },
    ],
    results: [
        { id: "r1", operationId: "o3", operationName: "Fan", valueToSend: 42 },
        { id: "r2", operationId: "o4", operationName: "Led", valueToSend: "#fff" },
    ],
};

const expectInvalid = (fn: () => unknown) => {
    try {
        fn();
    } catch (e) {
        expect((e as { code: number }).code).toBe(Code.InvalidArgument);
        return;
    }
    throw new Error("did not throw");
};

describe("automations REST routes", () => {
    it("covers every RPC", () => {
        expect(automationsRoutes.map((e) => e.key).sort()).toEqual(
            AutomationsService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("createAutomation body and response", () => {
        const r = route("createAutomation");
        expect(r.method).toBe("POST");
        expect(r.path({} as never)).toBe("v1/automations");
        const req = create(CreateAutomationRequestSchema, {
            homeId: "h1",
            name: "n",
            icon: "i",
            conditionConnector: ConditionConnector.OR,
            conditions: [
                {
                    operationId: "o1",
                    conditionType: ConditionType.BOOLEAN,
                    conditionConfiguration: { isOn: true },
                },
            ],
            results: [{ operationId: "o2", valueToSend: toProtoValue(7) }],
        });
        expect(plain(r.body!(req as never))).toEqual({
            homeId: "h1",
            name: "n",
            icon: "i",
            conditionConnector: "Or",
            conditions: [
                {
                    operationId: "o1",
                    conditionType: "BooleanCondition",
                    conditionConfiguration: { isOn: true },
                },
            ],
            results: [{ operationId: "o2", valueToSend: 7 }],
        });
        expect(r.response({ id: "a9" }, 201)).toEqual({ id: "a9" });
    });

    it("getAutomation path and wrapped response", () => {
        const r = route("getAutomation");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetAutomationRequestSchema, { automationId: "a1" }) as never)).toBe(
            "v1/automations/a1",
        );
        const out = r.response(modelJson, 200) as { automation: Record<string, any> };
        const a = out.automation;
        expect(a.id).toBe("a1");
        expect(a.homeId).toBe("h1");
        expect(a.conditionConnector).toBe(ConditionConnector.AND);
        expect(a.isEnabled).toBe(true);
        expect(a.conditions[0]).toEqual({
            id: "c1",
            operationId: "o1",
            operationName: "Lamp",
            conditionType: ConditionType.NUMBER,
            conditionConfiguration: { minValue: 1, maxValue: 5 },
        });
        expect(a.conditions[1].conditionType).toBe(ConditionType.UNSPECIFIED);
        expect(a.conditions[1].conditionConfiguration).toEqual({});
        expect(a.results[0].id).toBe("r1");
        expect(a.results[0].valueToSend.kind).toEqual({ case: "numberValue", value: 42 });
        expect(a.results[1].valueToSend.kind).toEqual({ case: "stringValue", value: "#fff" });
    });

    it("updateAutomation partial body", () => {
        const r = route("updateAutomation");
        expect(r.method).toBe("PATCH");
        expect(r.path(create(UpdateAutomationRequestSchema, { automationId: "a1" }) as never)).toBe(
            "v1/automations/a1",
        );
        const body = (init: object) =>
            plain(
                r.body!(
                    create(UpdateAutomationRequestSchema, { automationId: "a1", ...init }) as never,
                ),
            );
        expect(body({})).toEqual({});
        expect(body({ name: "n", icon: "i" })).toEqual({ name: "n", icon: "i" });
        expect(body({ conditionConnector: ConditionConnector.AND })).toEqual({
            conditionConnector: "And",
        });
        expect(
            body({
                conditions: [{ operationId: "o1", conditionType: ConditionType.TEXT }],
                results: [{ operationId: "o2", valueToSend: toProtoValue("x") }],
            }),
        ).toEqual({
            conditions: [
                { operationId: "o1", conditionType: "TextCondition", conditionConfiguration: {} },
            ],
            results: [{ operationId: "o2", valueToSend: "x" }],
        });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteAutomation", () => {
        const r = route("deleteAutomation");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteAutomationRequestSchema, { automationId: "a1" }) as never)).toBe(
            "v1/automations/a1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("displayAutomations query and response", () => {
        const r = route("displayAutomations");
        expect(r.method).toBe("GET");
        expect(r.path(create(DisplayAutomationsRequestSchema, { homeId: "a b" }) as never)).toBe(
            "v1/automations/display?homeId=a%20b",
        );
        const out = r.response({ items: [modelJson] }, 200) as { items: Record<string, any>[] };
        expect(out.items).toHaveLength(1);
        expect(out.items[0].name).toBe("Night");
        expect(r.response({ items: [] }, 200)).toEqual({ items: [] });
    });

    it("automationState", () => {
        const r = route("automationState");
        expect(r.method).toBe("PUT");
        const req = create(AutomationStateRequestSchema, { automationId: "a1", isEnabled: true });
        expect(r.path(req as never)).toBe("v1/automations/a1/state");
        expect(plain(r.body!(req as never))).toEqual({ isEnabled: true });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("putConditionToAutomation", () => {
        const r = route("putConditionToAutomation");
        expect(r.method).toBe("PUT");
        const req = create(PutConditionToAutomationRequestSchema, {
            automationId: "a1",
            operationId: "o1",
            conditionType: ConditionType.TEXT,
            conditionConfiguration: { requiredValue: "x" },
        });
        expect(r.path(req as never)).toBe("v1/automations/conditions/a1");
        expect(plain(r.body!(req as never))).toEqual({
            operationId: "o1",
            conditionType: "TextCondition",
            conditionConfiguration: { requiredValue: "x" },
        });
        expect(r.response(undefined, 200)).toEqual({});
    });

    it("putResultToAutomation", () => {
        const r = route("putResultToAutomation");
        expect(r.method).toBe("PUT");
        const req = create(PutResultToAutomationRequestSchema, {
            automationId: "a1",
            operationId: "o1",
            value: "5",
        });
        expect(r.path(req as never)).toBe("v1/automations/results/a1");
        expect(plain(r.body!(req as never))).toEqual({ operationId: "o1", value: "5" });
        expect(r.response(undefined, 200)).toEqual({});
    });

    it("deleteCondition and deleteResult", () => {
        const c = route("deleteCondition");
        expect(c.method).toBe("DELETE");
        expect(c.path(create(DeleteConditionRequestSchema, { conditionId: "c1" }) as never)).toBe(
            "v1/automations/conditions/c1",
        );
        expect(c.response(undefined, 204)).toEqual({});
        const d = route("deleteResult");
        expect(d.method).toBe("DELETE");
        expect(d.path(create(DeleteResultRequestSchema, { resultId: "r1" }) as never)).toBe(
            "v1/automations/results/r1",
        );
        expect(d.response(undefined, 204)).toEqual({});
    });

    it("rejects empty path ids and homeId", () => {
        expectInvalid(() =>
            route("getAutomation").path(create(GetAutomationRequestSchema) as never),
        );
        expectInvalid(() =>
            route("deleteCondition").path(create(DeleteConditionRequestSchema) as never),
        );
        expectInvalid(() => route("deleteResult").path(create(DeleteResultRequestSchema) as never));
        expectInvalid(() =>
            route("putResultToAutomation").path(
                create(PutResultToAutomationRequestSchema) as never,
            ),
        );
        expectInvalid(() =>
            route("displayAutomations").path(create(DisplayAutomationsRequestSchema) as never),
        );
    });
});
