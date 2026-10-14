import { createLiveUpdateSource } from "@/api/liveUpdates/createLiveUpdateSource";

jest.mock("@/api/liveUpdates/SignalRLiveUpdateSource", () => ({
    createSignalRLiveUpdateSource: jest.fn(() => ({ kind: "signalr", subscribe: jest.fn() })),
}));
jest.mock("@/api/liveUpdates/LiveUpdateSource", () => ({
    createGrpcLiveUpdateSource: jest.fn(() => ({ kind: "grpc", subscribe: jest.fn() })),
}));

const base = { signalRUrl: "http://x/hub", getAccessToken: () => "t", client: {} as any };

describe("createLiveUpdateSource", () => {
    it("uses SignalR in Rest mode", () => {
        const s: any = createLiveUpdateSource({ ...base, mode: "Rest" });
        expect(s.kind).toBe("signalr");
        expect(typeof s.subscribe).toBe("function");
    });
    it.each(["Grpc", "GrpcWeb"] as const)("uses gRPC in %s mode", (mode) => {
        const s: any = createLiveUpdateSource({ ...base, mode });
        expect(s.kind).toBe("grpc");
    });
});
