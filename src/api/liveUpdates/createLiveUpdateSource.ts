import type { Client } from "@connectrpc/connect";
import type { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import type { TransportMode } from "@/api/transport/TransportMode";
import { createGrpcLiveUpdateSource, type LiveUpdateSource } from "./LiveUpdateSource";
import { createSignalRLiveUpdateSource } from "./SignalRLiveUpdateSource";

export interface CreateLiveUpdateSourceOptions {
    mode: TransportMode;
    signalRUrl: string;
    getAccessToken: () => string;
    client: Client<typeof LiveUpdatesService>;
}

/** SignalR in REST mode; the gRPC server stream for Grpc / GrpcWeb. */
export const createLiveUpdateSource = (o: CreateLiveUpdateSourceOptions): LiveUpdateSource =>
    o.mode === "Rest"
        ? createSignalRLiveUpdateSource({ url: o.signalRUrl, getAccessToken: o.getAccessToken })
        : createGrpcLiveUpdateSource(o.client);
