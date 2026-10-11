import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { LegalService } from "@/generated/users/v1/legal";
import { LegalServiceClient } from "@/generated/users/v1/legal.client";
import { UsersService } from "@/generated/users/v1/users";
import { UsersServiceClient } from "@/generated/users/v1/users.client";
import { createGrpcTransport, withAuthorization } from "@/api/grpc/createGrpcTransport";
import { NativeGrpcTransport } from "@/api/grpc/native/NativeGrpcTransport";
import { NativeGrpcBridge } from "@/api/grpc/native/nativeGrpcBridge";

const mockExpoFetch = jest.fn();
jest.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => mockExpoFetch(...args) }));

const fakeBridge = (): jest.Mocked<NativeGrpcBridge> =>
    ({
        unary: jest.fn().mockResolvedValue({
            status: 0,
            message: "",
            responseBase64: "",
            headers: {},
            trailers: {},
        }),
        startServerStream: jest.fn(),
        cancel: jest.fn(),
        addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    }) as unknown as jest.Mocked<NativeGrpcBridge>;

const deps = (bridge: NativeGrpcBridge, token?: string) => ({
    getBaseUrl: () => new URL("https://localhost:7070/ignored/path"),
    getAccessToken: () => token,
    bridge,
});

describe("withAuthorization", () => {
    it("adds a bearer token for protected services", () => {
        const options = withAuthorization(UsersService.methods[0], { meta: { a: "b" } }, "t1");
        expect(options.meta).toEqual({ a: "b", authorization: "Bearer t1" });
    });

    it("skips anonymous services", () => {
        const options = withAuthorization(LegalService.methods[0], {}, "t1");
        expect(options.meta).toBeUndefined();
    });

    it("skips when there is no token", () => {
        expect(withAuthorization(UsersService.methods[0], {}, undefined).meta).toBeUndefined();
        expect(withAuthorization(UsersService.methods[0], {}, "").meta).toBeUndefined();
    });

    it("keeps an explicit authorization header", () => {
        const options = withAuthorization(
            UsersService.methods[0],
            { meta: { authorization: "Bearer fresh" } },
            "stale",
        );
        expect(options.meta).toEqual({ authorization: "Bearer fresh" });
    });
});

describe("createGrpcTransport", () => {
    it("builds a native transport that sends the token through the interceptor", async () => {
        const bridge = fakeBridge();
        const transport = createGrpcTransport("Grpc", deps(bridge, "t1"));

        expect(transport).toBeInstanceOf(NativeGrpcTransport);

        await new UsersServiceClient(transport).getUser({});

        const [, baseUrl, method, , metadata] = bridge.unary.mock.calls[0];
        expect(baseUrl).toBe("https://localhost:7070");
        expect(method).toBe("senswave.users.v1.UsersService/GetUser");
        expect(metadata).toEqual({ authorization: ["Bearer t1"] });
    });

    it("builds a gRPC-Web transport on expo/fetch with the API origin", async () => {
        if (typeof globalThis.Headers === "undefined") {
            (globalThis as any).Headers = class {
                private values = new Map<string, string>();
                set(k: string, v: string) {
                    this.values.set(k.toLowerCase(), v);
                }
                append(k: string, v: string) {
                    this.values.set(k.toLowerCase(), v);
                }
                get(k: string) {
                    return this.values.get(k.toLowerCase()) ?? null;
                }
            };
        }
        mockExpoFetch.mockRejectedValue(new TypeError("offline"));
        const transport = createGrpcTransport("GrpcWeb", deps(fakeBridge()));

        expect(transport).toBeInstanceOf(GrpcWebFetchTransport);

        await new LegalServiceClient(transport).getPrivacyPolicy({}).then(
            () => undefined,
            () => undefined,
        );

        expect(mockExpoFetch).toHaveBeenCalledWith(
            "https://localhost:7070/senswave.users.v1.LegalService/GetPrivacyPolicy",
            expect.objectContaining({ method: "POST" }),
        );
    });
});
