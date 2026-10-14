import { Code } from "@connectrpc/connect";
import type { Client } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    LiveUpdateSchema,
    type LiveUpdate,
    type LiveUpdatesService,
} from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { ApiError, toApiError } from "@/api/errors";

export type Unsubscribe = () => void;

export interface LiveUpdateSource {
    subscribe(
        homeId: string,
        onUpdate: (update: LiveUpdate) => void,
        onError: (error: ApiError) => void,
    ): Unsubscribe;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export const signalRUpdateToLiveUpdate = (updateType: string, data: unknown): LiveUpdate | null => {
    const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
    switch (updateType) {
        case "deviceTileActionUpdate":
            return create(LiveUpdateSchema, {
                update: { case: "deviceTile", value: { deviceId: str(d.deviceId) } },
            });
        case "widgetsActionUpdate":
            return create(LiveUpdateSchema, {
                update: { case: "widgets", value: { deviceId: str(d.deviceId), widgetIds: [] } },
            });
        case "dataSourceStateUpdate":
            return create(LiveUpdateSchema, {
                update: {
                    case: "dataSourceState",
                    value: { dataSourceId: str(d.dataSourceId), state: str(d.state) },
                },
            });
        case "devicePresenceUpdate":
            return create(LiveUpdateSchema, {
                update: { case: "devicePresence", value: { deviceId: str(d.deviceId) } },
            });
        default:
            return null;
    }
};

export const createGrpcLiveUpdateSource = (
    client: Client<typeof LiveUpdatesService>,
): LiveUpdateSource => ({
    subscribe(homeId, onUpdate, onError) {
        const ac = new AbortController();
        // Consumer callbacks must never break the stream loop or surface as unhandled rejections.
        const safeError = (err: ApiError) => {
            try {
                onError(err);
            } catch (e) {
                console.error("[LiveUpdate] onError threw", e);
            }
        };
        (async () => {
            try {
                for await (const u of client.subscribe(
                    { homeReferenceId: homeId },
                    { signal: ac.signal },
                )) {
                    if (ac.signal.aborted) return;
                    try {
                        onUpdate(u);
                    } catch (e) {
                        console.error("[LiveUpdate] onUpdate threw", e);
                    }
                }
                if (!ac.signal.aborted) {
                    safeError(
                        new ApiError({
                            code: Code.Unavailable,
                            message: "Live update stream ended",
                        }),
                    );
                }
            } catch (e) {
                if (!ac.signal.aborted) safeError(toApiError(e));
            }
        })().catch(() => undefined);
        return () => ac.abort();
    },
});
