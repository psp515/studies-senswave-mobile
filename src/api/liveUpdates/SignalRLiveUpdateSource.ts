import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { HubConnectionBuilder, LogLevel, type HubConnection } from "@microsoft/signalr";
import { LiveUpdateSchema } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { ApiError, toApiError } from "@/api/errors";
import { signalRUpdateToLiveUpdate, type LiveUpdateSource } from "./LiveUpdateSource";

export interface SignalRLiveUpdateSourceOptions {
    url: string;
    getAccessToken: () => string;
    /** test seam; default builds HubConnectionBuilder().withUrl(url, { accessTokenFactory }).build() */
    buildConnection?: (url: string, accessTokenFactory: () => string) => HubConnection;
}

const defaultBuildConnection = (url: string, accessTokenFactory: () => string): HubConnection =>
    new HubConnectionBuilder()
        .withUrl(url, { accessTokenFactory })
        .configureLogging(LogLevel.Warning)
        .build();

export const createSignalRLiveUpdateSource = (
    o: SignalRLiveUpdateSourceOptions,
): LiveUpdateSource => ({
    subscribe(homeId, onUpdate, onError) {
        let stopped = false;
        const connection = (o.buildConnection ?? defaultBuildConnection)(o.url, o.getAccessToken);

        connection.on("Update", (updateType: string, data: unknown) => {
            if (stopped) return;
            const u = signalRUpdateToLiveUpdate(updateType, data);
            if (u) onUpdate(u);
            else console.info(`[Live Update] Unknown update type: ${updateType}`);
        });

        const finish = (err: ApiError) => {
            if (stopped) return;
            stopped = true;
            connection.stop().catch(() => undefined);
            onError(err);
        };

        connection.on("Initialized", () => {
            if (stopped) return;
            onUpdate(create(LiveUpdateSchema, { update: { case: "initialized", value: {} } }));
        });

        // Hub contract: FailedToInitialize(reason). Access problems are terminal; anything else
        // (e.g. throttling) is Unavailable so the provider retries.
        connection.on("FailedToInitialize", (reason: string) => {
            const message = typeof reason === "string" ? reason : "";
            finish(
                new ApiError({
                    code: /access/i.test(message) ? Code.PermissionDenied : Code.Unavailable,
                    message,
                }),
            );
        });

        // Compatibility alias for older servers.
        connection.on("AccessNotGrantedToHome", (deniedHomeId: string) => {
            finish(
                new ApiError({
                    code: Code.PermissionDenied,
                    message: `Access not granted to home ${deniedHomeId}`,
                }),
            );
        });

        connection.onclose(() => {
            finish(
                new ApiError({ code: Code.Unavailable, message: "Live update connection closed" }),
            );
        });

        connection
            .start()
            .then(() => connection.invoke("Initialize", homeId))
            .catch((e) => finish(toApiError(e)));

        return () => {
            stopped = true;
            connection.stop().catch(() => undefined);
        };
    },
});
