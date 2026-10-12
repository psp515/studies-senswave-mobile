export type TransportMode = "Rest" | "Grpc" | "GrpcWeb";

const transportModes: readonly TransportMode[] = ["Rest", "Grpc", "GrpcWeb"];

export const parseTransportMode = (value: string | undefined): TransportMode => {
    if (!value) {
        return "Rest";
    }

    const mode = transportModes.find((m) => m === value);

    if (!mode) {
        console.error(
            `[Transport] Invalid EXPO_PUBLIC_TRANSPORT "${value}". Expected Rest, Grpc or GrpcWeb. Falling back to Rest.`,
        );
        return "Rest";
    }

    return mode;
};

// Direct property access: Expo inlines EXPO_PUBLIC_* variables at build time.
export const transportMode: TransportMode = parseTransportMode(process.env.EXPO_PUBLIC_TRANSPORT);

export const isGrpcMode = (mode: TransportMode): boolean => mode !== "Rest";

export const validateBaseUrlForMode = (mode: TransportMode, baseUrl: URL): string | null => {
    if (isGrpcMode(mode) && baseUrl.protocol !== "https:") {
        return `Transport ${mode} requires an https:// API URL, got ${baseUrl.origin}.`;
    }

    return null;
};

/** API origin for gRPC modes; null in Rest mode (getBaseUrl is not called) or when the URL is invalid. */
export const resolveGrpcOrigin = (mode: TransportMode, getBaseUrl: () => URL): string | null => {
    if (!isGrpcMode(mode)) {
        return null;
    }

    try {
        return getBaseUrl().origin;
    } catch (error) {
        console.error("[Transport] Failed to resolve the API URL.", error);
        return null;
    }
};
