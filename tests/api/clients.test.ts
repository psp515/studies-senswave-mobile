import { createApiClients } from "@/api/clients";
import { createTransport } from "@/api/transport/createTransport";

describe("createApiClients", () => {
    it("exposes a client per service", () => {
        const transport = createTransport({ mode: "Rest", baseUrl: "https://h", interceptors: [] });
        const api = createApiClients(transport);
        expect(typeof api.homes.getHome).toBe("function");
        expect(typeof api.auth.login).toBe("function");
        expect(typeof api.liveUpdates.subscribe).toBe("function");
    });

    it("createTransport rejects the unimplemented Grpc mode", () => {
        expect(() =>
            createTransport({ mode: "Grpc", baseUrl: "https://h", interceptors: [] }),
        ).toThrow(/Grpc/);
    });
});
