import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
    CreateBrokerRequestSchema,
    CreateSubscribtionRequestSchema,
    DataSourcesService,
    DeleteBrokerRequestSchema,
    DeleteSubscribtionRequestSchema,
    GetBrokerRequestSchema,
    GetBrokersRequestSchema,
    GetClientStateRequestSchema,
    GetSessionRequestSchema,
    GetSessionsRequestSchema,
    GetSubscribtionsRequestSchema,
    RestartClientRequestSchema,
    StartClientRequestSchema,
    StopClientRequestSchema,
    UpdateBrokerRequestSchema,
} from "@/api/gen/datasources/v1/datasources_pb";
import { dataSourcesRoutes } from "@/api/transport/rest/routes/dataSources";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof DataSourcesService.method) =>
    dataSourcesRoutes.find((e) => e.key === routeKey(DataSourcesService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
const ts = (iso: string) => timestampFromDate(new Date(iso));

const expectInvalid = (fn: () => unknown) => {
    try {
        fn();
    } catch (e) {
        expect((e as { code: number }).code).toBe(Code.InvalidArgument);
        return;
    }
    throw new Error("did not throw");
};

describe("dataSources REST routes", () => {
    it("covers every RPC", () => {
        expect(dataSourcesRoutes.map((e) => e.key).sort()).toEqual(
            DataSourcesService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("getBrokers path and response", () => {
        const r = route("getBrokers");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetBrokersRequestSchema, {}) as never)).toBe("v1/datasources/brokers");
        expect(r.path(create(GetBrokersRequestSchema, { page: 2, size: 5 }) as never)).toBe(
            "v1/datasources/brokers?page=2&size=5",
        );
        expect(
            r.response(
                {
                    items: [
                        {
                            id: "b1",
                            name: "n",
                            server: "s",
                            createdAt: "2026-01-01T00:00:00",
                            updatedAt: "2026-01-02T00:00:00Z",
                        },
                    ],
                },
                200,
            ),
        ).toEqual({
            items: [
                {
                    id: "b1",
                    name: "n",
                    server: "s",
                    createdAt: ts("2026-01-01T00:00:00Z"),
                    updatedAt: ts("2026-01-02T00:00:00Z"),
                },
            ],
        });
    });

    it("getBroker path and response", () => {
        const r = route("getBroker");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetBrokerRequestSchema, { brokerId: "b1" }) as never)).toBe(
            "v1/datasources/brokers/b1",
        );
        expect(
            r.response(
                {
                    id: "b1",
                    name: "n",
                    url: "u",
                    protocolVersion: "MqttV5",
                    clientName: "c",
                    port: 1883,
                    useTls: true,
                    createdAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-02T00:00:00Z",
                },
                200,
            ),
        ).toEqual({
            id: "b1",
            name: "n",
            url: "u",
            protocolVersion: "MqttV5",
            clientName: "c",
            port: 1883,
            useTls: true,
            createdAt: ts("2026-01-01T00:00:00Z"),
            updatedAt: ts("2026-01-02T00:00:00Z"),
        });
    });

    it("createBroker", () => {
        const r = route("createBroker");
        expect(r.method).toBe("POST");
        expect(r.path({} as never)).toBe("v1/datasources/brokers");
        const body = {
            name: "n",
            url: "u",
            clientName: "c",
            port: 1883,
            protocolVersion: "MqttV5",
            useTls: true,
            username: "us",
            password: "pw",
        };
        expect(plain(r.body!(create(CreateBrokerRequestSchema, body) as never))).toEqual(body);
        expect(r.response({ id: "b9" }, 201)).toEqual({ id: "b9" });
    });

    it("updateBroker omits unset port/useTls", () => {
        const r = route("updateBroker");
        expect(r.method).toBe("PATCH");
        const base = {
            name: "n",
            url: "u",
            clientName: "c",
            protocolVersion: "MqttV5",
            username: "us",
            password: "pw",
        };
        expect(
            r.path(create(UpdateBrokerRequestSchema, { brokerId: "b1", ...base }) as never),
        ).toBe("v1/datasources/brokers/b1");
        const body = (init: object) =>
            plain(
                r.body!(
                    create(UpdateBrokerRequestSchema, {
                        brokerId: "b1",
                        ...base,
                        ...init,
                    }) as never,
                ),
            );
        expect(body({})).toEqual(base);
        expect(body({ port: 1, useTls: false })).toEqual({ ...base, port: 1, useTls: false });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteBroker", () => {
        const r = route("deleteBroker");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteBrokerRequestSchema, { brokerId: "b1" }) as never)).toBe(
            "v1/datasources/brokers/b1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("client routes", () => {
        const state = route("getClientState");
        expect(state.method).toBe("GET");
        expect(state.path(create(GetClientStateRequestSchema, { brokerId: "b1" }) as never)).toBe(
            "v1/datasources/brokers/b1/clients",
        );
        expect(
            state.response({ connectionStatus: "Connected", latestSessionId: "s1" }, 200),
        ).toEqual({ connectionStatus: "Connected", latestSessionId: "s1" });

        const start = route("startClient");
        expect(start.method).toBe("POST");
        const sreq = create(StartClientRequestSchema, {
            brokerId: "b1",
            username: "u",
            password: "p",
        });
        expect(start.path(sreq as never)).toBe("v1/datasources/brokers/b1/clients");
        expect(plain(start.body!(sreq as never))).toEqual({ username: "u", password: "p" });
        expect(start.response(undefined, 204)).toEqual({});

        const stop = route("stopClient");
        expect(stop.method).toBe("DELETE");
        expect(stop.path(create(StopClientRequestSchema, { brokerId: "b1" }) as never)).toBe(
            "v1/datasources/brokers/b1/clients",
        );
        expect(stop.response(undefined, 204)).toEqual({});

        const restart = route("restartClient");
        expect(restart.method).toBe("PATCH");
        const rreq = create(RestartClientRequestSchema, { brokerId: "b1" });
        expect(restart.path(rreq as never)).toBe("v1/datasources/brokers/b1/clients/restart");
        expect(plain(restart.body!(rreq as never))).toEqual({});
        expect(restart.response(undefined, 204)).toEqual({});
    });

    it("subscribtion routes", () => {
        const list = route("getSubscribtions");
        expect(list.method).toBe("GET");
        expect(list.path(create(GetSubscribtionsRequestSchema, { brokerId: "b1" }) as never)).toBe(
            "v1/datasources/brokers/b1/subscriptions",
        );
        expect(
            list.path(
                create(GetSubscribtionsRequestSchema, {
                    brokerId: "b1",
                    page: 1,
                    size: 10,
                }) as never,
            ),
        ).toBe("v1/datasources/brokers/b1/subscriptions?page=1&size=10");
        expect(
            list.response(
                {
                    items: [
                        {
                            id: "s1",
                            topic: "a/b",
                            createdAt: "2026-01-01T00:00:00",
                            updatedAt: "2026-01-02T00:00:00Z",
                        },
                    ],
                },
                200,
            ),
        ).toEqual({
            items: [
                {
                    id: "s1",
                    topic: "a/b",
                    createdAt: ts("2026-01-01T00:00:00Z"),
                    updatedAt: ts("2026-01-02T00:00:00Z"),
                },
            ],
        });

        const add = route("createSubscribtion");
        expect(add.method).toBe("POST");
        const creq = create(CreateSubscribtionRequestSchema, { brokerId: "b1", topic: "t" });
        expect(add.path(creq as never)).toBe("v1/datasources/brokers/b1/subscriptions");
        expect(plain(add.body!(creq as never))).toEqual({ topic: "t" });
        expect(add.response({ id: "s9" }, 201)).toEqual({ id: "s9" });

        const del = route("deleteSubscribtion");
        expect(del.method).toBe("DELETE");
        expect(
            del.path(
                create(DeleteSubscribtionRequestSchema, {
                    brokerId: "b1",
                    subscriptionId: "s1",
                }) as never,
            ),
        ).toBe("v1/datasources/brokers/b1/subscriptions/s1");
        expect(del.response(undefined, 204)).toEqual({});
    });

    it("session routes", () => {
        const list = route("getSessions");
        expect(list.method).toBe("GET");
        expect(list.path(create(GetSessionsRequestSchema, { brokerId: "b1" }) as never)).toBe(
            "v1/datasources/brokers/b1/sessions",
        );
        expect(
            list.path(
                create(GetSessionsRequestSchema, { brokerId: "b1", page: 3, size: 4 }) as never,
            ),
        ).toBe("v1/datasources/brokers/b1/sessions?page=3&size=4");
        expect(
            list.response(
                {
                    items: [
                        {
                            id: "s1",
                            updatedAtUtc: "2026-01-02T00:00:00",
                            createdAtUtc: "2026-01-01T00:00:00Z",
                            finished: true,
                        },
                    ],
                },
                200,
            ),
        ).toEqual({
            items: [
                {
                    id: "s1",
                    updatedAtUtc: ts("2026-01-02T00:00:00Z"),
                    createdAtUtc: ts("2026-01-01T00:00:00Z"),
                    finished: true,
                },
            ],
        });

        const get = route("getSession");
        expect(get.method).toBe("GET");
        expect(
            get.path(create(GetSessionRequestSchema, { brokerId: "b1", sessionId: "s1" }) as never),
        ).toBe("v1/datasources/brokers/b1/sessions/s1");
        expect(
            get.response(
                {
                    id: "s1",
                    logs: [
                        {
                            id: "l1",
                            eventType: "Connected",
                            data: "d",
                            createdAtUtc: "2026-01-01T00:00:00",
                        },
                    ],
                    createdAtUtc: "2026-01-01T00:00:00Z",
                    updatedAtUtc: "2026-01-02T00:00:00Z",
                },
                200,
            ),
        ).toEqual({
            id: "s1",
            logs: [
                {
                    id: "l1",
                    eventType: "Connected",
                    data: "d",
                    createdAtUtc: ts("2026-01-01T00:00:00Z"),
                },
            ],
            createdAtUtc: ts("2026-01-01T00:00:00Z"),
            updatedAtUtc: ts("2026-01-02T00:00:00Z"),
        });
    });

    it("rejects empty and encodes path ids", () => {
        expectInvalid(() => route("getBroker").path(create(GetBrokerRequestSchema) as never));
        expectInvalid(() => route("getSessions").path(create(GetSessionsRequestSchema) as never));
        expectInvalid(() =>
            route("deleteSubscribtion").path(
                create(DeleteSubscribtionRequestSchema, { brokerId: "b1" }) as never,
            ),
        );
        expect(
            route("getBroker").path(create(GetBrokerRequestSchema, { brokerId: "a b" }) as never),
        ).toBe("v1/datasources/brokers/a%20b");
    });
});
