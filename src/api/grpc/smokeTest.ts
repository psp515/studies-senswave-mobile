import { RpcTransport } from "@protobuf-ts/runtime-rpc";
import { LegalServiceClient } from "@/generated/users/v1/legal.client";
import { defaultGrpcTimeoutMs } from "./executeGrpcCall";

/** Anonymous probe proving the transport, TLS and codegen work end to end. Development only. */
export const runGrpcSmokeTest = async (transport: RpcTransport): Promise<boolean> => {
    try {
        const { response } = await new LegalServiceClient(transport).getPrivacyPolicy(
            {},
            { timeout: defaultGrpcTimeoutMs },
        );
        console.info(`[GrpcClient] Smoke test OK: privacy policy version ${response.version}`);
        return true;
    } catch (e) {
        console.error("[GrpcClient] Smoke test failed", e);
        return false;
    }
};
