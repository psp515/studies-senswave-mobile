import React, { createContext, FC, PropsWithChildren, useContext, useMemo, useRef } from "react";
import { createApiClients, type ApiClients } from "@/api/clients";
import { createInterceptors } from "@/api/interceptors";
import { createTransport } from "@/api/transport/createTransport";
import type { TransportMode } from "@/api/transport/TransportMode";
import { ApiError } from "@/api/errors";
import { useConfiguration } from "./ConfigurationProvider";
import { useSession } from "./SessionProvider";
import { useToast } from "./ToastProvider";

export interface ApiContextValue extends ApiClients {
    transportMode: TransportMode;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export const useApi = (): ApiContextValue => {
    const ctx = useContext(ApiContext);
    if (!ctx) {
        throw new Error("useApi must be used within ApiProvider.");
    }
    return ctx;
};

const RefreshFailureToastThreshold = 10;

export const ApiProvider: FC<PropsWithChildren> = ({ children }) => {
    const session = useSession();
    const configuration = useConfiguration();
    const toast = useToast();

    // Refs keep latest values accessible inside stable interceptors without rebuilding clients.
    const sessionRef = useRef(session);
    sessionRef.current = session;
    const toastRef = useRef(toast);
    toastRef.current = toast;
    const refreshFailureCountRef = useRef(0);

    const baseUrl = configuration.getBaseUrl().origin;
    const transportMode = configuration.transportMode;

    const value = useMemo<ApiContextValue>(() => {
        const interceptors = createInterceptors({
            getAccessToken: () => {
                const s = sessionRef.current.session;
                return s.authenticated && s.accessToken ? s.accessToken : null;
            },
            refresh: async () => {
                const token = await sessionRef.current.refresh();
                if (token) refreshFailureCountRef.current = 0;
                return token;
            },
            logout: () => sessionRef.current.logout(),
            onRefreshFailed: () => {
                refreshFailureCountRef.current++;
                if (refreshFailureCountRef.current >= RefreshFailureToastThreshold) {
                    refreshFailureCountRef.current = 0;
                    toastRef.current.error("Please check your internet connection.");
                }
            },
            onForbidden: (error) => {
                const text = ApiError.is(error) ? error.firstDescription() : error.rawMessage;
                toastRef.current.error(text || "Access denied.");
            },
        });

        const transport = createTransport({ mode: transportMode, baseUrl, interceptors });
        console.info(`[Api] Transport ${transportMode} → ${baseUrl}`);

        return { ...createApiClients(transport), transportMode };
    }, [baseUrl, transportMode]);

    return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};
