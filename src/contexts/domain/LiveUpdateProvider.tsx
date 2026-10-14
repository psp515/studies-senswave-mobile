import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { LiveUpdate } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { nextRetryDelayMs } from "@/api/liveUpdates/retryPolicy";
import { useApi } from "../ApiProvider";
import { useSession } from "../SessionProvider";
import { useHomes } from "./HomeProvider";
import { useDevice } from "../custom/DeviceProvider";
import { useDeviceList } from "../custom/DeviceListProvider";

interface LiveUpdateProperties {
    addDeviceTileCallback: (deviceId: string, callback: (message: string) => Promise<any>) => void;
    addHomeDataSourceCallback: (callback: (message: string) => Promise<any>) => void;
}

const LiveUpdateContext = createContext<LiveUpdateProperties>({
    addDeviceTileCallback: () => {},
    addHomeDataSourceCallback: () => {},
});

export const useLiveUpdate = () => useContext(LiveUpdateContext);

export const LiveUpdateProvider = ({ children }: any) => {
    const api = useApi();
    const session = useSession();
    const home = useHomes();
    const device = useDevice();
    const deviceList = useDeviceList();

    const addDeviceTileCallback = useCallback(
        (deviceId: string, callback: (message: string) => Promise<any>) => {
            devicesCallbacks.current.set(deviceId, callback);
            console.debug(`[Live Update] Callback set for device: ${deviceId}`);
        },
        [],
    );

    const addHomeDataSourceCallback = useCallback((callback: (message: string) => Promise<any>) => {
        homeDataSourceCallback.current = callback;
        console.debug(`[Live Update] Callback set for home data source`);
    }, []);

    const devicesCallbacks = useRef<Map<string, (message: string) => Promise<any>>>(new Map());
    const homeDataSourceCallback = useRef<(message: string) => Promise<any>>(() =>
        Promise.resolve(),
    );

    const [retry, setRetry] = useState(0);

    const homeRef = useRef(home);
    homeRef.current = home;
    const deviceRef = useRef(device);
    deviceRef.current = device;
    const deviceListRef = useRef(deviceList);
    deviceListRef.current = deviceList;

    const widgetUpdate = async (deviceId: string) => {
        try {
            console.info("[Live Update] Widget update for device:", deviceId);
            await deviceRef.current.smartRefresh(deviceId);
        } catch (error) {
            console.error("[Live Update] Error executing deviceTileActionUpdate", error);
        }
    };

    const homeDataSourceUpdate = async (dataSourceId: string, state: string) => {
        try {
            console.info("[Live Update] DataSource update in home.");
            await homeRef.current.updateHomeDataSourceState(dataSourceId, state);
        } catch (error) {
            console.error("[Live Update] Error executing dataSourceStateUpdate", error);
        }
    };

    const dispatch = (u: LiveUpdate) => {
        const update = u.update;
        console.info(`[Live Update] Received update: ${update.case}`);
        switch (update.case) {
            case "deviceTile":
                try {
                    const callback = devicesCallbacks.current.get(update.value.deviceId);
                    if (callback) {
                        Promise.resolve(
                            callback({ deviceId: update.value.deviceId } as unknown as string),
                        ).catch((error) =>
                            console.error(
                                "[Live Update] Error executing deviceTileActionUpdate",
                                error,
                            ),
                        );
                    }
                } catch (error) {
                    console.error("[Live Update] Error executing deviceTileActionUpdate", error);
                }
                break;
            case "widgets":
                widgetUpdate(update.value.deviceId).catch((error) =>
                    console.error("[Live Update] Error executing widgetsActionUpdate", error),
                );
                break;
            case "dataSourceState":
                homeDataSourceUpdate(update.value.dataSourceId, update.value.state).catch((error) =>
                    console.error("[Live Update] Error executing dataSourceStateUpdate", error),
                );
                break;
            case "devicePresence":
                Promise.resolve(deviceListRef.current.refreshDevice(update.value.deviceId)).catch(
                    (error) =>
                        console.error("[Live Update] Error executing devicePresenceUpdate", error),
                );
                break;
            case "initialized":
                console.info("[Live Update] Subscription initialized.");
                break;
            default:
                console.info("[Live Update] Unknown update.");
        }
    };
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;

    const homeId = home.current?.id;
    // The server-side subscription snapshot includes the home's data-source group, so a changed
    // data source requires resubscribing. Depend on the id only: `home.current` is replaced on
    // every state update (e.g. dataSourceState) and would resubscribe on each live update.
    const dataSourceId = home.current?.dataSource?.id;
    const authenticated = session.session.authenticated;
    const source = api.liveUpdateSource;

    useEffect(() => {
        if (!authenticated || !homeId) return;

        console.info(`[Live Update] Observing updates for home: ${homeId}`);
        let timer: ReturnType<typeof setTimeout> | undefined;
        let hadInitialized = false;
        const unsubscribe = source.subscribe(
            homeId,
            (u) => {
                if (u.update.case === "initialized") hadInitialized = true;
                dispatchRef.current(u);
            },
            (err) => {
                console.error("[Live Update] Subscription error:", err.message);
                const delay = nextRetryDelayMs(err, hadInitialized);
                if (delay === null) {
                    console.warn("[Live Update] Terminal subscription error, not retrying.");
                    return;
                }
                timer = setTimeout(() => setRetry((r) => r + 1), delay);
            },
        );

        return () => {
            unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, [homeId, dataSourceId, authenticated, source, retry]);

    const value = {
        addDeviceTileCallback,
        addHomeDataSourceCallback,
    };

    return <LiveUpdateContext.Provider value={value}>{children}</LiveUpdateContext.Provider>;
};
