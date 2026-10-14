import React, { createContext, FC, PropsWithChildren, useContext, useMemo } from "react";
import { createAnonymousApi, type AnonymousApi } from "@/api/anonymousClients";
import { resolveBaseUrl } from "@/api/transport/createTransport";
import { useConfiguration } from "./ConfigurationProvider";

const AnonymousApiContext = createContext<AnonymousApi | null>(null);

export const useAnonymousApi = (): AnonymousApi => {
    const ctx = useContext(AnonymousApiContext);
    if (!ctx) {
        throw new Error("useAnonymousApi must be used within AnonymousApiProvider.");
    }
    return ctx;
};

export const AnonymousApiProvider: FC<PropsWithChildren> = ({ children }) => {
    const configuration = useConfiguration();

    const baseUrl = resolveBaseUrl(() => configuration.getBaseUrl()) ?? "";
    const mode = configuration.transportMode;

    const value = useMemo(
        () => createAnonymousApi({ baseUrl: baseUrl || null, mode }),
        [baseUrl, mode],
    );

    return <AnonymousApiContext.Provider value={value}>{children}</AnonymousApiContext.Provider>;
};
