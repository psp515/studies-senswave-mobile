import { create } from "@bufbuild/protobuf";
import { GetBrokerResponseSchema } from "@/api/gen/datasources/v1/datasources_pb";
import { toDataSourceDto } from "@/types/DataSourcesTypes";

describe("toDataSourceDto", () => {
    it("maps a broker response", () => {
        expect(
            toDataSourceDto(
                create(GetBrokerResponseSchema, {
                    id: "b1",
                    name: "Home",
                    url: "mqtt.local",
                    protocolVersion: "MqttV311",
                    clientName: "app",
                    port: 1883,
                    useTls: false,
                }),
            ),
        ).toEqual({
            id: "b1",
            name: "Home",
            url: "mqtt.local",
            clientName: "app",
            port: 1883,
            protocolVersion: "MqttV311",
            useTls: false,
        });
    });
});
