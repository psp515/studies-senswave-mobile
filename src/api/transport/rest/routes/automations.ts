import { AutomationsService } from "@/api/gen/automations/v1/automations_pb";
import { fromProtoValue, toProtoValue } from "@/api/json";
import {
    conditionTypeFromString,
    conditionTypeToString,
    connectorFromString,
    connectorToString,
} from "@/types/AutomationsTypes";
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

const automationModel = (j: Record<string, unknown>) => ({
    id: str(j.id),
    homeId: str(j.homeId),
    name: str(j.name),
    icon: str(j.icon),
    conditionConnector: connectorFromString(j.conditionConnector),
    isEnabled: bool(j.isEnabled),
    conditions: items(j.conditions, (c) => ({
        id: str(c.id),
        operationId: str(c.operationId),
        operationName: str(c.operationName),
        conditionType: conditionTypeFromString(c.conditionType),
        conditionConfiguration: structFromJson(c.conditionConfiguration),
    })),
    results: items(j.results, (r) => ({
        id: str(r.id),
        operationId: str(r.operationId),
        operationName: str(r.operationName),
        valueToSend: toProtoValue(r.valueToSend),
    })),
});

type ConditionIn = {
    operationId: string;
    conditionType: Parameters<typeof conditionTypeToString>[0];
    conditionConfiguration?: Record<string, unknown>;
};
type ResultIn = { operationId: string; valueToSend?: Parameters<typeof fromProtoValue>[0] };

const conditionBody = (c: ConditionIn) => ({
    operationId: c.operationId,
    conditionType: conditionTypeToString(c.conditionType),
    conditionConfiguration: c.conditionConfiguration ?? {},
});

const resultBody = (r: ResultIn) => ({
    operationId: r.operationId,
    valueToSend: fromProtoValue(r.valueToSend),
});

export const automationsRoutes = defineRoutes(AutomationsService, {
    createAutomation: {
        method: "POST",
        path: () => "v1/automations",
        body: (req) => ({
            homeId: req.homeId,
            name: req.name,
            icon: req.icon,
            conditionConnector: connectorToString(req.conditionConnector),
            conditions: req.conditions.map(conditionBody),
            results: req.results.map(resultBody),
        }),
        response: idResponse,
    },
    getAutomation: {
        method: "GET",
        path: (req) => `v1/automations/${seg(req.automationId, "automationId")}`,
        response: (json) => ({ automation: automationModel(asRecord(json)) }),
    },
    updateAutomation: {
        method: "PATCH",
        path: (req) => `v1/automations/${seg(req.automationId, "automationId")}`,
        body: (req) => ({
            name: req.name || undefined,
            icon: req.icon || undefined,
            conditionConnector: connectorToString(req.conditionConnector) || undefined,
            conditions: req.conditions.length ? req.conditions.map(conditionBody) : undefined,
            results: req.results.length ? req.results.map(resultBody) : undefined,
        }),
        response: empty,
    },
    deleteAutomation: {
        method: "DELETE",
        path: (req) => `v1/automations/${seg(req.automationId, "automationId")}`,
        response: empty,
    },
    displayAutomations: {
        method: "GET",
        path: (req) => `v1/automations/display${query({ homeId: required(req.homeId, "homeId") })}`,
        response: (json) => ({ items: items(json, automationModel) }),
    },
    automationState: {
        method: "PUT",
        path: (req) => `v1/automations/${seg(req.automationId, "automationId")}/state`,
        body: (req) => ({ isEnabled: req.isEnabled }),
        response: empty,
    },
    putConditionToAutomation: {
        method: "PUT",
        path: (req) => `v1/automations/conditions/${seg(req.automationId, "automationId")}`,
        body: (req) => conditionBody(req),
        response: empty,
    },
    putResultToAutomation: {
        method: "PUT",
        path: (req) => `v1/automations/results/${seg(req.automationId, "automationId")}`,
        body: (req) => ({ operationId: req.operationId, value: req.value }),
        response: empty,
    },
    deleteCondition: {
        method: "DELETE",
        path: (req) => `v1/automations/conditions/${seg(req.conditionId, "conditionId")}`,
        response: empty,
    },
    deleteResult: {
        method: "DELETE",
        path: (req) => `v1/automations/results/${seg(req.resultId, "resultId")}`,
        response: empty,
    },
});
