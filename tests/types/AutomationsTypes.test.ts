import { create } from "@bufbuild/protobuf";
import {
    AutomationModelSchema,
    ConditionConnector,
    ConditionModelSchema,
    ConditionType,
    ResultModelSchema,
} from "@/api/gen/automations/v1/automations_pb";
import { toProtoValue } from "@/api/json";
import {
    toAutomationDto,
    toConditionMessage,
    toResultMessage,
    conditionTypeFromString,
    conditionTypeToString,
    connectorFromString,
    connectorToString,
} from "@/types/AutomationsTypes";

describe("automation enum helpers", () => {
    it("maps connectors both ways", () => {
        expect(connectorToString(ConditionConnector.AND)).toBe("And");
        expect(connectorToString(ConditionConnector.OR)).toBe("Or");
        expect(connectorToString(ConditionConnector.UNSPECIFIED)).toBe("");
        expect(connectorFromString("And")).toBe(ConditionConnector.AND);
        expect(connectorFromString("Or")).toBe(ConditionConnector.OR);
        expect(connectorFromString("")).toBe(ConditionConnector.UNSPECIFIED);
        expect(connectorFromString("zzz")).toBe(ConditionConnector.UNSPECIFIED);
        expect(connectorFromString(undefined)).toBe(ConditionConnector.UNSPECIFIED);
    });

    it("maps condition types both ways", () => {
        expect(conditionTypeToString(ConditionType.BOOLEAN)).toBe("BooleanCondition");
        expect(conditionTypeToString(ConditionType.NUMBER)).toBe("NumberCondition");
        expect(conditionTypeToString(ConditionType.TEXT)).toBe("TextCondition");
        expect(conditionTypeToString(ConditionType.UNSPECIFIED)).toBe("");
        expect(conditionTypeFromString("BooleanCondition")).toBe(ConditionType.BOOLEAN);
        expect(conditionTypeFromString("NumberCondition")).toBe(ConditionType.NUMBER);
        expect(conditionTypeFromString("TextCondition")).toBe(ConditionType.TEXT);
        expect(conditionTypeFromString("Empty")).toBe(ConditionType.UNSPECIFIED);
        expect(conditionTypeFromString("Invalid")).toBe(ConditionType.UNSPECIFIED);
        expect(conditionTypeFromString("InvalidCondition")).toBe(ConditionType.UNSPECIFIED);
        expect(conditionTypeFromString(null)).toBe(ConditionType.UNSPECIFIED);
    });
});

describe("automation mappers", () => {
    it("maps a full model", () => {
        const dto = toAutomationDto(
            create(AutomationModelSchema, {
                id: "a1",
                homeId: "h1",
                name: "Night",
                icon: "moon",
                conditionConnector: ConditionConnector.OR,
                isEnabled: true,
                conditions: [
                    create(ConditionModelSchema, {
                        id: "c1",
                        operationId: "o1",
                        operationName: "Lamp",
                        conditionType: ConditionType.NUMBER,
                        conditionConfiguration: { minValue: 1, maxValue: 5 },
                    }),
                    create(ConditionModelSchema, { id: "c2", operationId: "o2" }),
                ],
                results: [
                    create(ResultModelSchema, {
                        id: "r1",
                        operationId: "o3",
                        operationName: "Fan",
                        valueToSend: toProtoValue(true),
                    }),
                ],
            }),
        );
        expect(dto).toEqual({
            id: "a1",
            homeId: "h1",
            name: "Night",
            icon: "moon",
            conditionConnector: "Or",
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
                    operationName: "",
                    conditionType: "InvalidCondition",
                    conditionConfiguration: {},
                },
            ],
            results: [{ id: "r1", operationId: "o3", operationName: "Fan", valueToSend: true }],
        });
    });

    it("round-trips condition and result messages", () => {
        const c = toConditionMessage({
            operationId: "o1",
            operationName: "x",
            conditionType: "BooleanCondition",
            conditionConfiguration: { isOn: true },
        });
        expect(c.conditionType).toBe(ConditionType.BOOLEAN);
        expect(c.conditionConfiguration).toEqual({ isOn: true });
        const r = toResultMessage({ operationId: "o2", operationName: "y", valueToSend: "#fff" });
        expect(r.operationId).toBe("o2");
        expect(r.valueToSend?.kind).toEqual({ case: "stringValue", value: "#fff" });
    });
});
