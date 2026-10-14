export type TransportMode = "Rest" | "Grpc" | "GrpcWeb";

export const TransportModes: readonly TransportMode[] = ["Rest", "Grpc", "GrpcWeb"];

export const parseTransportMode = (value: string | undefined | null): TransportMode | null => {
    if (!value) return null;
    const lower = value.toLowerCase();
    return TransportModes.find((m) => m.toLowerCase() === lower) ?? null;
};

export const resolveTransportMode = (
    env: string | undefined,
    override: string | null,
    isDevelopment: boolean,
): TransportMode => {
    if (isDevelopment) {
        const o = parseTransportMode(override);
        if (o) return o;
    }
    return parseTransportMode(env) ?? "Rest";
};
