import React, {
    createContext,
    FC,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { RpcTransport } from "@protobuf-ts/runtime-rpc";
import {
    isGrpcMode,
    TransportMode,
    transportMode,
    validateBaseUrlForMode,
} from "@/config/transport";
import { createGrpcTransport } from "@/api/grpc/createGrpcTransport";
import { executeGrpcCall, GrpcCallDeps, GrpcInvoke, GrpcOutcome } from "@/api/grpc/executeGrpcCall";
import { getNativeGrpcBridge } from "@/api/grpc/native/nativeModule";
import { runGrpcSmokeTest } from "@/api/grpc/smokeTest";
import { useSession } from "./SessionProvider";
import { useConfiguration } from "./ConfigurationProvider";
import { useToast } from "./ToastProvider";

interface GrpcClientContextValue {
    mode: TransportMode;
    /** null in Rest mode. */
    transport: RpcTransport | null;
    call: <O extends object>(invoke: GrpcInvoke<O>) => Promise<GrpcOutcome<O>>;
}

const GrpcClientContext = createContext<GrpcClientContextValue>({
    mode: transportMode,
    transport: null,
    call: async () => {
        console.error("[GrpcClient] Not initialized.");
        return {
            isSuccess: false,
            kind: "connectionError",
            code: "UNKNOWN",
            error: { statusText: "", errors: [] },
        };
    },
});

export const useGrpcClient = () => useContext(GrpcClientContext);

export const GrpcClientProvider: FC<PropsWithChildren> = ({ children }) => {
    const session = useSession();
    const configuration = useConfiguration();
    const toast = useToast();

    // Refs keep latest values accessible inside stable callbacks without triggering re-renders
    const sessionRef = useRef(session);
    sessionRef.current = session;
    const configurationRef = useRef(configuration);
    configurationRef.current = configuration;
    const toastRef = useRef(toast);
    toastRef.current = toast;

    const refreshFailureCountRef = useRef(0);

    const origin = configuration.getBaseUrl().origin;

    const transport = useMemo(
        () =>
            isGrpcMode(transportMode)
                ? createGrpcTransport(transportMode as Exclude<TransportMode, "Rest">, {
                      getBaseUrl: () => configurationRef.current.getBaseUrl(),
                      getAccessToken: () => sessionRef.current.session.accessToken,
                      getBridge: getNativeGrpcBridge,
                  })
                : null,
        // Rebuilt when the API origin changes (overrideUrl in Development).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [origin],
    );

    useEffect(() => {
        console.info(`[GrpcClient] Transport mode: ${transportMode}`);
        const problem = validateBaseUrlForMode(transportMode, new URL(origin));
        if (problem) {
            console.error(`[GrpcClient] ${problem}`);
        }
    }, [origin]);

    useEffect(() => {
        if (transport && configurationRef.current.isDevelopment()) {
            runGrpcSmokeTest(transport);
        }
    }, [transport]);

    const deps = useMemo<GrpcCallDeps>(
        () => ({
            isAuthenticated: () => sessionRef.current.session.authenticated,
            refresh: () => sessionRef.current.refresh(),
            logout: () => sessionRef.current.logout(),
            onSuccess: () => {
                refreshFailureCountRef.current = 0;
            },
            onRefreshFailed: () => {
                console.error("[GrpcClient] Failed to refresh auth token");
                refreshFailureCountRef.current++;
                if (refreshFailureCountRef.current >= 10) {
                    refreshFailureCountRef.current = 0;
                    toastRef.current.error("Please check your internet connection.");
                }
            },
            onConsentMissing: (error) => {
                console.warn("[GrpcClient] Logged out due to missing consents.");
                toastRef.current.apiError(error);
            },
        }),
        [],
    );

    const call = useCallback(
        <O extends object>(invoke: GrpcInvoke<O>) => executeGrpcCall(deps, invoke),
        [deps],
    );

    const contextValue = useMemo(
        () => ({ mode: transportMode, transport, call }),
        [transport, call],
    );

    return <GrpcClientContext.Provider value={contextValue}>{children}</GrpcClientContext.Provider>;
};
