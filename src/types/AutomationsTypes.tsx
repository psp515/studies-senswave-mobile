import {
    ConditionConnector as ProtoConnector,
    ConditionType as ProtoConditionType,
} from "@/api/gen/automations/v1/automations_pb";
import { OperationType } from "@/types/DeviceTypes";

export type ConditionType =
    | "BooleanCondition"
    | "NumberCondition"
    | "TextCondition"
    | "InvalidCondition";
export type ConditionConnector = "And" | "Or";

export type AutomationConditionDto = {
    operationId: string;
    operationName: string;
    conditionType: ConditionType;

    conditionConfiguration: any;
};

export type AutomationResultDto = {
    operationId: string;
    operationName: string;

    valueToSend: any;
};

export type AutomationDto = {
    id: string;
    homeId: string;
    name: string;
    icon: string;
    conditionConnector: ConditionConnector;
    isEnabled: boolean;

    conditions?: AutomationConditionDto[];
    results?: AutomationResultDto[];
};

export const OperationToConditionMap: Record<OperationType, ConditionType> = {
    Boolean: "BooleanCondition",
    Number: "NumberCondition",
    Integer: "NumberCondition",
    Text: "TextCondition",
    HexColor: "TextCondition",
    Options: "TextCondition",
};

export const connectorToString = (c: ProtoConnector): ConditionConnector | "" =>
    c === ProtoConnector.AND ? "And" : c === ProtoConnector.OR ? "Or" : "";

export const connectorFromString = (s: unknown): ProtoConnector =>
    s === "And" ? ProtoConnector.AND : s === "Or" ? ProtoConnector.OR : ProtoConnector.UNSPECIFIED;

export const conditionTypeToString = (
    t: ProtoConditionType,
): Exclude<ConditionType, "InvalidCondition"> | "" =>
    t === ProtoConditionType.BOOLEAN
        ? "BooleanCondition"
        : t === ProtoConditionType.NUMBER
          ? "NumberCondition"
          : t === ProtoConditionType.TEXT
            ? "TextCondition"
            : "";

export const conditionTypeFromString = (s: unknown): ProtoConditionType =>
    s === "BooleanCondition"
        ? ProtoConditionType.BOOLEAN
        : s === "NumberCondition"
          ? ProtoConditionType.NUMBER
          : s === "TextCondition"
            ? ProtoConditionType.TEXT
            : ProtoConditionType.UNSPECIFIED;
