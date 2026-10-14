import React, {
    createContext,
    FC,
    PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { createApiClients, type ApiClients } from "@/api/clients";
import { createInterceptors } from "@/api/interceptors";
import { resolveBaseUrl, resolveTransport } from "@/api/transport/createTransport";
import { shouldLogoutOnChange } from "@/api/transport/changeDetection";
import type { TransportMode } from "@/api/transport/TransportMode";
import { ApiError } from "@/api/errors";
import { createLiveUpdateSource } from "@/api/liveUpdates/createLiveUpdateSource";
import type { LiveUpdateSource } from "@/api/liveUpdates/LiveUpdateSource";
import { useConfiguration } from "./ConfigurationProvider";
import { useSession } from "./SessionProvider";
import { useToast } from "./ToastProvider";

export interface ApiContextValue extends ApiClients {
    /** Effective mode; "Rest" when the requested mode is not implemented. */
    transportMode: TransportMode;
    /** Mode requested by configuration, so a selector can warn when it differs. */
    requestedTransportMode: TransportMode;
    /** SignalR in Rest mode, gRPC stream otherwise. */
    liveUpdateSource: LiveUpdateSource;
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

    // Never throw during render: a missing/invalid URL yields an Unavailable transport.
    const baseUrl = resolveBaseUrl(() => configuration.getBaseUrl()) ?? "";
    const requestedTransportMode = configuration.transportMode;
    let signalRUrl: string | null = null;
    try {
        signalRUrl = configuration.getSignalRUrl("signalr/liveupdates/live").toString();
    } catch (e) {
        console.error("[Api] SignalR URL is not configured or invalid.", e);
    }

    // The session belongs to one backend + transport: end it when either changes (not on mount).
    const prevRef = useRef<{ baseUrl: string; mode: TransportMode } | null>(null);
    useEffect(() => {
        const next = { baseUrl, mode: requestedTransportMode };
        if (
            shouldLogoutOnChange(prevRef.current, next) &&
            sessionRef.current.session.authenticated
        ) {
            console.info("[Api] Transport changed, logging out.");
            sessionRef.current.logout();
        }
        prevRef.current = next;
    }, [baseUrl, requestedTransportMode]);

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
                const text = ApiError.is(error) ? error.errors[0]?.description?.trim() : undefined;
                toastRef.current.error(text || "Access denied.");
            },
        });

        const { transport, mode } = resolveTransport({
            mode: requestedTransportMode,
            baseUrl: baseUrl || null,
            interceptors,
        });
        console.info(`[Api] Transport ${mode} → ${baseUrl || "(unconfigured)"}`);

        const clients = createApiClients(transport);

        const liveUpdateSource = createLiveUpdateSource({
            mode,
            signalRUrl,
            getAccessToken: () => sessionRef.current.session.accessToken ?? "",
            client: clients.liveUpdates,
        });

        return {
            ...clients,
            transportMode: mode,
            requestedTransportMode,
            liveUpdateSource,
        };
    }, [baseUrl, signalRUrl, requestedTransportMode]);

    return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};
