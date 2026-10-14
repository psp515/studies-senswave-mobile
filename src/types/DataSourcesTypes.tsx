import type { GetBrokerResponse } from "@/api/gen/datasources/v1/datasources_pb";

export type MqttVersion = "MqttV5" | "MqttV311" | "MqttV310";

export type DataSourceDto = {
    id: string;
    name: string;
    url: string;
    clientName: string;
    port: number;
    protocolVersion: MqttVersion;
    useTls: boolean;
};

export type SubscriptionDto = {
    id: string;
    topic: string;
};

export type CreateSubscriptionRequest = {
    topic: string;
};

export const toDataSourceDto = (r: GetBrokerResponse): DataSourceDto => ({
    id: r.id,
    name: r.name,
    url: r.url,
    clientName: r.clientName,
    port: r.port,
    protocolVersion: r.protocolVersion as MqttVersion,
    useTls: r.useTls,
});
