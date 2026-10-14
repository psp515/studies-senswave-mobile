import { DataSourcesService } from "@/api/gen/datasources/v1/datasources_pb";
import { defineRoutes } from "../RestRoute";
import {
    asRecord,
    bool,
    empty,
    idResponse,
    items,
    num,
    query,
    seg,
    str,
    timestampFromIso,
} from "../converters";

const paging = (req: { page: number; size: number }) =>
    query({ page: req.page || undefined, size: req.size || undefined });

const brokerPath = (brokerId: string) => `v1/datasources/brokers/${seg(brokerId, "brokerId")}`;

export const dataSourcesRoutes = defineRoutes(DataSourcesService, {
    getBrokers: {
        method: "GET",
        path: (req) => `v1/datasources/brokers${paging(req)}`,
        response: (json) => ({
            items: items(json, (b) => ({
                id: str(b.id),
                name: str(b.name),
                server: str(b.server),
                createdAt: timestampFromIso(b.createdAt),
                updatedAt: timestampFromIso(b.updatedAt),
            })),
        }),
    },
    getBroker: {
        method: "GET",
        path: (req) => brokerPath(req.brokerId),
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                name: str(j.name),
                url: str(j.url),
                protocolVersion: str(j.protocolVersion),
                clientName: str(j.clientName),
                port: num(j.port),
                useTls: bool(j.useTls),
                createdAt: timestampFromIso(j.createdAt),
                updatedAt: timestampFromIso(j.updatedAt),
            };
        },
    },
    createBroker: {
        method: "POST",
        path: () => "v1/datasources/brokers",
        body: (req) => ({
            name: req.name,
            url: req.url,
            clientName: req.clientName,
            port: req.port,
            protocolVersion: req.protocolVersion,
            useTls: req.useTls,
            username: req.username,
            password: req.password,
        }),
        response: idResponse,
    },
    updateBroker: {
        method: "PATCH",
        path: (req) => brokerPath(req.brokerId),
        body: (req) => ({
            name: req.name,
            url: req.url,
            clientName: req.clientName,
            port: req.port,
            protocolVersion: req.protocolVersion,
            useTls: req.useTls,
            username: req.username,
            password: req.password,
        }),
        response: empty,
    },
    deleteBroker: {
        method: "DELETE",
        path: (req) => brokerPath(req.brokerId),
        response: empty,
    },
    getClientState: {
        method: "GET",
        path: (req) => `${brokerPath(req.brokerId)}/clients`,
        response: (json) => {
            const j = asRecord(json);
            return {
                connectionStatus: str(j.connectionStatus),
                latestSessionId: str(j.latestSessionId),
            };
        },
    },
    startClient: {
        method: "POST",
        path: (req) => `${brokerPath(req.brokerId)}/clients`,
        body: (req) => ({ username: req.username, password: req.password }),
        response: empty,
    },
    stopClient: {
        method: "DELETE",
        path: (req) => `${brokerPath(req.brokerId)}/clients`,
        response: empty,
    },
    restartClient: {
        method: "PATCH",
        path: (req) => `${brokerPath(req.brokerId)}/clients/restart`,
        body: () => ({}),
        response: empty,
    },
    getSubscribtions: {
        method: "GET",
        path: (req) => `${brokerPath(req.brokerId)}/subscriptions${paging(req)}`,
        response: (json) => ({
            items: items(json, (s) => ({
                id: str(s.id),
                topic: str(s.topic),
                createdAt: timestampFromIso(s.createdAt),
                updatedAt: timestampFromIso(s.updatedAt),
            })),
        }),
    },
    createSubscribtion: {
        method: "POST",
        path: (req) => `${brokerPath(req.brokerId)}/subscriptions`,
        body: (req) => ({ topic: req.topic }),
        response: idResponse,
    },
    deleteSubscribtion: {
        method: "DELETE",
        path: (req) =>
            `${brokerPath(req.brokerId)}/subscriptions/${seg(req.subscriptionId, "subscriptionId")}`,
        response: empty,
    },
    getSessions: {
        method: "GET",
        path: (req) => `${brokerPath(req.brokerId)}/sessions${paging(req)}`,
        response: (json) => ({
            items: items(json, (s) => ({
                id: str(s.id),
                updatedAtUtc: timestampFromIso(s.updatedAtUtc),
                createdAtUtc: timestampFromIso(s.createdAtUtc),
                finished: bool(s.finished),
            })),
        }),
    },
    getSession: {
        method: "GET",
        path: (req) => `${brokerPath(req.brokerId)}/sessions/${seg(req.sessionId, "sessionId")}`,
        response: (json) => {
            const j = asRecord(json);
            return {
                id: str(j.id),
                logs: items(j.logs, (l) => ({
                    id: str(l.id),
                    eventType: str(l.eventType),
                    data: str(l.data),
                    createdAtUtc: timestampFromIso(l.createdAtUtc),
                })),
                createdAtUtc: timestampFromIso(j.createdAtUtc),
                updatedAtUtc: timestampFromIso(j.updatedAtUtc),
            };
        },
    },
});
