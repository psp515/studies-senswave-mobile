import {
    isGrpcMode,
    parseTransportMode,
    resolveGrpcOrigin,
    validateBaseUrlForMode,
} from "@/config/transport";

describe("parseTransportMode", () => {
    it.each([
        ["Rest", "Rest"],
        ["Grpc", "Grpc"],
        ["GrpcWeb", "GrpcWeb"],
    ])("accepts %s", (value, expected) => {
        expect(parseTransportMode(value)).toBe(expected);
    });

    it("defaults to Rest when unset or empty", () => {
        expect(parseTransportMode(undefined)).toBe("Rest");
        expect(parseTransportMode("")).toBe("Rest");
    });

    it("falls back to Rest and logs on an invalid value", () => {
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        expect(parseTransportMode("grpc")).toBe("Rest");
        expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid EXPO_PUBLIC_TRANSPORT"));
        spy.mockRestore();
    });
});

describe("isGrpcMode", () => {
    it("is false only for Rest", () => {
        expect(isGrpcMode("Rest")).toBe(false);
        expect(isGrpcMode("Grpc")).toBe(true);
        expect(isGrpcMode("GrpcWeb")).toBe(true);
    });
});

describe("validateBaseUrlForMode", () => {
    it("accepts any URL in Rest mode", () => {
        expect(validateBaseUrlForMode("Rest", new URL("http://10.0.2.2:8080"))).toBeNull();
    });

    it("accepts https in gRPC modes", () => {
        expect(validateBaseUrlForMode("Grpc", new URL("https://localhost:7070"))).toBeNull();
        expect(validateBaseUrlForMode("GrpcWeb", new URL("https://localhost:7070"))).toBeNull();
    });

    it("rejects http in gRPC modes", () => {
        expect(validateBaseUrlForMode("Grpc", new URL("http://10.0.2.2:8080"))).toBe(
            "Transport Grpc requires an https:// API URL, got http://10.0.2.2:8080.",
        );
    });
});

describe("resolveGrpcOrigin", () => {
    it("returns null in Rest mode without calling getBaseUrl", () => {
        const getBaseUrl = jest.fn();
        expect(resolveGrpcOrigin("Rest", getBaseUrl)).toBeNull();
        expect(getBaseUrl).not.toHaveBeenCalled();
    });

    it("returns the API origin in gRPC modes", () => {
        const getBaseUrl = () => new URL("https://example.com:7070/api/v1");
        expect(resolveGrpcOrigin("Grpc", getBaseUrl)).toBe("https://example.com:7070");
        expect(resolveGrpcOrigin("GrpcWeb", getBaseUrl)).toBe("https://example.com:7070");
    });

    it("logs and returns null when getBaseUrl throws", () => {
        const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        expect(
            resolveGrpcOrigin("Grpc", () => {
                throw new Error("bad url");
            }),
        ).toBeNull();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
