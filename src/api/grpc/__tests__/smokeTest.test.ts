import { RpcError, TestTransport } from "@protobuf-ts/runtime-rpc";
import { GetPrivacyPolicyResponse } from "@/generated/users/v1/legal";
import { runGrpcSmokeTest } from "@/api/grpc/smokeTest";

describe("runGrpcSmokeTest", () => {
    it("returns true when the privacy policy loads", async () => {
        const info = jest.spyOn(console, "info").mockImplementation(() => {});
        const transport = new TestTransport({
            response: GetPrivacyPolicyResponse.create({ version: "2.0.0" }),
        });

        await expect(runGrpcSmokeTest(transport)).resolves.toBe(true);
        expect(info).toHaveBeenCalledWith(expect.stringContaining("2.0.0"));
        info.mockRestore();
    });

    it("returns false on a gRPC error", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        const transport = new TestTransport({
            response: new RpcError("down", "UNAVAILABLE"),
        });

        await expect(runGrpcSmokeTest(transport)).resolves.toBe(false);
        error.mockRestore();
    });
});
