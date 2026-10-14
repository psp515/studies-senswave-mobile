import { ConditionConnector, ConditionType } from "@/api/gen/automations/v1/automations_pb";
import {
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
