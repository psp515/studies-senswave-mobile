import { resolveTransportMode, TransportMode } from "@/api/transport/TransportMode";
import { executeTimeout } from "@/utils/httpClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from "react";

interface VersionResponse {
    version: string;
}

interface ConfigurationContextType {
    getBaseUrl: () => URL;
    getApiUrl: (path: string) => URL;
    getSignalRUrl: (path: string) => URL;
    overrideUrl: (url: string) => void;
    transportMode: TransportMode;
    /** True once the persisted transport override has been read from storage. */
    isHydrated: boolean;
    overrideTransportMode: (mode: TransportMode | null) => void;
    isDevelopment: () => boolean;
    isAppCompatibleWithApi: () => Promise<boolean>;
}

// disable @typescript-eslint/no-unused-vars in section below
const ConfigurationContext = createContext<ConfigurationContextType>({
    getBaseUrl(): URL {
        console.error("[Configuration Context] Not initialized.");
        return new URL("");
    },
    getApiUrl(): URL {
        console.error("[Configuration Context] Not initialized.");
        return new URL("");
    },
    getSignalRUrl(): URL {
        console.error("[Configuration Context] Not initialized.");
        return new URL("");
    },
    overrideUrl(): void {
        console.error("[Configuration Context] Not initialized.");
    },
    transportMode: "Rest",
    isHydrated: false,
    overrideTransportMode(): void {
        console.error("[Configuration Context] Not initialized.");
    },
    isDevelopment(): boolean {
        console.error("[Configuration Context] Not initialized.");
        return false;
    },
    isAppCompatibleWithApi(): Promise<boolean> {
        // default to a resolved promise to match the expected return type
        return Promise.resolve(false);
    },
});

export const useConfiguration = () => useContext(ConfigurationContext);

export const ConfigurationProvider: FC<PropsWithChildren> = ({ children }) => {
    const [urlOverride, setUrlOverride] = useState<string>("");
    const TransportOverrideKey = "configuration.transportModeOverride";
    const [transportOverride, setTransportOverride] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    const isDevelopment = (): boolean => {
        return process.env.EXPO_PUBLIC_ENVIRONMENT === "Development";
    };

    useEffect(() => {
        AsyncStorage.getItem(TransportOverrideKey)
            .then((v) => setTransportOverride(v))
            .catch(() => undefined)
            .finally(() => setIsHydrated(true));
    }, []);

    const overrideTransportMode = (mode: TransportMode | null) => {
        if (!isDevelopment()) {
            console.warn(
                "[Configuration Context] Cannot override transport mode in production mode.",
            );
            return;
        }
        setTransportOverride(mode);
        if (mode) {
            AsyncStorage.setItem(TransportOverrideKey, mode).catch(() => undefined);
        } else {
            AsyncStorage.removeItem(TransportOverrideKey).catch(() => undefined);
        }
        console.info(`[Configuration Context] Transport mode override: ${mode ?? "none"}`);
    };

    const transportMode = resolveTransportMode(
        process.env.EXPO_PUBLIC_TRANSPORT_MODE,
        transportOverride,
        isDevelopment(),
    );

    const overrideUrl = (url: string) => {
        const devEnv = isDevelopment();

        if (devEnv) {
            setUrlOverride(url);
            console.info(`[Configuration Context] Base URL overridden to ${url}`);
        } else {
            console.warn("[Configuration Context] Cannot override base URL in production mode.");
        }
    };

    const getBaseUrl = (): URL => {
        const devEnv = isDevelopment();

        if (devEnv && urlOverride && urlOverride !== "") {
            console.debug(`[Configuration Context] Using overridden URL: ${urlOverride}`);
            return new URL(urlOverride);
        }

        const env = process.env.EXPO_PUBLIC_SENSWAVE__API__URL;

        if (!env) {
            console.error(
                "Invalid API URL. Please set the environment variable EXPO_PUBLIC_SENSWAVE__API__URL.",
            );
            throw new Error("API URL not set.");
        }

        try {
            return new URL(env);
        } catch (error) {
            console.error(`Error ${error}. Invalid API URL: ${env}`);
            throw new Error("Invalid API URL.");
        }
    };

    const getApiUrl = (path: string): URL => {
        if (!path || path === "") {
            throw new Error("Invalid path.");
        }

        const baseUrl = getBaseUrl();

        if (path.startsWith("/")) {
            path = path.substring(1);
        }

        return new URL(`/api/${path}`, baseUrl);
    };

    const getSignalRUrl = (path: string): URL => {
        if (!path || path === "") {
            throw new Error("Invalid path.");
        }

        const baseUrl = getBaseUrl();

        return new URL(path, baseUrl);
    };

    const isCompatible = (apiVersion: string): boolean => {
        const parse = (v: string) => v.split(".").map((num) => parseInt(num, 10) || 0);

        const [appMajor, appMinor, appPatch] = parse(process.env.EXPO_PUBLIC_MINIMAL_API_VERSION);
        const [apiMajor, apiMinor, apiPatch] = parse(apiVersion);

        if (appMajor !== apiMajor) return false;

        if (appMinor !== apiMinor) return false;

        if (appPatch > apiPatch) return false;

        return true;
    };

    const isAppCompatibleWithApi = async () => {
        const url = getApiUrl("version");

        const options: RequestInit = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        };

        try {
            const response = await executeTimeout(url, options, 5000);

            if (!response.isSuccess) {
                console.error("[Configuration Provider] Api might not be available.");
                return false;
            }

            const data: VersionResponse = await response.response?.json();

            const compatible = isCompatible(data.version);

            if (compatible) {
                console.info("[Configuration Provider] Api is compatible with app.");
                return true;
            }

            console.warn("[Configuration Provider] Api is not compatible with app.");
            return false;
        } catch {
            console.error("[Configuration Provider] Failed to determine api version.");
            return false;
        }
    };

    const value = {
        getBaseUrl: getBaseUrl,
        getApiUrl: getApiUrl,
        getSignalRUrl: getSignalRUrl,
        overrideUrl: overrideUrl,
        transportMode: transportMode,
        isHydrated: isHydrated,
        overrideTransportMode: overrideTransportMode,
        isDevelopment: isDevelopment,
        isAppCompatibleWithApi: isAppCompatibleWithApi,
    };

    return <ConfigurationContext.Provider value={value}>{children}</ConfigurationContext.Provider>;
};
