import { create, type JsonObject } from "@bufbuild/protobuf";
import {
    ConditionConnector as ProtoConnector,
    ConditionDtoSchema,
    ConditionType as ProtoConditionType,
    ResultDtoSchema,
    type AutomationModel,
    type ConditionDto,
    type ResultDto,
} from "@/api/gen/automations/v1/automations_pb";
import { fromProtoValue, structToJson, toProtoValue } from "@/api/json";
import { OperationType } from "@/types/DeviceTypes";

export type ConditionType =
    | "BooleanCondition"
    | "NumberCondition"
    | "TextCondition"
    | "InvalidCondition";
export type ConditionConnector = "And" | "Or";

export type AutomationConditionDto = {
    id?: string;
    operationId: string;
    operationName: string;
    conditionType: ConditionType;

    conditionConfiguration: any;
};

export type AutomationResultDto = {
    id?: string;
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

export const toAutomationDto = (m: AutomationModel): AutomationDto => ({
    id: m.id,
    homeId: m.homeId,
    name: m.name,
    icon: m.icon,
    conditionConnector: connectorToString(m.conditionConnector) as ConditionConnector,
    isEnabled: m.isEnabled,
    conditions: m.conditions.map((c) => ({
        id: c.id,
        operationId: c.operationId,
        operationName: c.operationName,
        conditionType: conditionTypeToString(c.conditionType) || "InvalidCondition",
        conditionConfiguration: structToJson(c.conditionConfiguration),
    })),
    results: m.results.map((r) => ({
        id: r.id,
        operationId: r.operationId,
        operationName: r.operationName,
        valueToSend: fromProtoValue(r.valueToSend),
    })),
});

export const toConditionMessage = (c: AutomationConditionDto): ConditionDto =>
    create(ConditionDtoSchema, {
        operationId: c.operationId,
        conditionType: conditionTypeFromString(c.conditionType),
        conditionConfiguration: (c.conditionConfiguration ?? {}) as JsonObject,
    });

export const toResultMessage = (r: AutomationResultDto): ResultDto =>
    create(ResultDtoSchema, {
        operationId: r.operationId,
        valueToSend: toProtoValue(r.valueToSend),
    });
