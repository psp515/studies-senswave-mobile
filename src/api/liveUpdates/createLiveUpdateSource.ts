import { Code, type Client } from "@connectrpc/connect";
import { ApiError } from "@/api/errors";
import type { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import type { TransportMode } from "@/api/transport/TransportMode";
import { createGrpcLiveUpdateSource, type LiveUpdateSource } from "./LiveUpdateSource";
import { createSignalRLiveUpdateSource } from "./SignalRLiveUpdateSource";

export interface CreateLiveUpdateSourceOptions {
    mode: TransportMode;
    /** null when SignalR is not configured; only needed in Rest mode. */
    signalRUrl: string | null;
    getAccessToken: () => string;
    client: Client<typeof LiveUpdatesService>;
}

export const createUnavailableLiveUpdateSource = (
    reason = "Live updates unavailable",
): LiveUpdateSource => ({
    subscribe: (_homeId, _onUpdate, onError) => {
        onError(new ApiError({ code: Code.Unavailable, message: reason }));
        return () => undefined;
    },
});

/** SignalR in REST mode; the gRPC server stream for Grpc / GrpcWeb. */
export const createLiveUpdateSource = (o: CreateLiveUpdateSourceOptions): LiveUpdateSource => {
    if (o.mode !== "Rest") return createGrpcLiveUpdateSource(o.client);
    if (!o.signalRUrl) return createUnavailableLiveUpdateSource("SignalR URL is not configured");
    return createSignalRLiveUpdateSource({ url: o.signalRUrl, getAccessToken: o.getAccessToken });
};
