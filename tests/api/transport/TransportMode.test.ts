import { parseTransportMode, resolveTransportMode } from "@/api/transport/TransportMode";

describe("parseTransportMode", () => {
    it("accepts known values case-insensitively", () => {
        expect(parseTransportMode("Rest")).toBe("Rest");
        expect(parseTransportMode("grpcweb")).toBe("GrpcWeb");
        expect(parseTransportMode("GRPC")).toBe("Grpc");
    });
    it("rejects unknown", () => {
        expect(parseTransportMode("soap")).toBeNull();
        expect(parseTransportMode(undefined)).toBeNull();
    });
});

describe("resolveTransportMode", () => {
    it("defaults to Rest", () => {
        expect(resolveTransportMode(undefined, null, false)).toBe("Rest");
    });
    it("uses env when valid", () => {
        expect(resolveTransportMode("GrpcWeb", null, false)).toBe("GrpcWeb");
    });
    it("override wins only in development", () => {
        expect(resolveTransportMode("Rest", "Grpc", true)).toBe("Grpc");
        expect(resolveTransportMode("Rest", "Grpc", false)).toBe("Rest");
    });
    it("ignores invalid override", () => {
        expect(resolveTransportMode("GrpcWeb", "nope", true)).toBe("GrpcWeb");
    });
});
