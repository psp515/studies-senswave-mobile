import { Code } from "@connectrpc/connect";
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
    it("reports Unavailable when Rest mode has no SignalR URL", () => {
        const s = createLiveUpdateSource({ ...base, signalRUrl: null, mode: "Rest" });
        const onError = jest.fn();
        const unsub = s.subscribe("h", jest.fn(), onError);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].code).toBe(Code.Unavailable);
        expect(() => unsub()).not.toThrow();
    });
    it("ignores a null SignalR URL in gRPC mode", () => {
        const s: any = createLiveUpdateSource({ ...base, signalRUrl: null, mode: "Grpc" });
        expect(s.kind).toBe("grpc");
    });
    it.each(["Grpc", "GrpcWeb"] as const)("uses gRPC in %s mode", (mode) => {
        const s: any = createLiveUpdateSource({ ...base, mode });
        expect(s.kind).toBe("grpc");
    });
});
