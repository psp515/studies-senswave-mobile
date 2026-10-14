import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { LiveUpdate } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { isPermissionDenied } from "@/api/call";
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
            homeRef.current.updateHomeDataSourceState(dataSourceId, state);
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
                        callback({ deviceId: update.value.deviceId } as unknown as string);
                    }
                } catch (error) {
                    console.error("[Live Update] Error executing deviceTileActionUpdate", error);
                }
                break;
            case "widgets":
                widgetUpdate(update.value.deviceId);
                break;
            case "dataSourceState":
                homeDataSourceUpdate(update.value.dataSourceId, update.value.state);
                break;
            case "devicePresence":
                deviceListRef.current.refreshDevice(update.value.deviceId);
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
    const authenticated = session.session.authenticated;
    const source = api.liveUpdateSource;

    useEffect(() => {
        if (!authenticated || !homeId) return;

        console.info(`[Live Update] Observing updates for home: ${homeId}`);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = source.subscribe(
            homeId,
            (u) => dispatchRef.current(u),
            (err) => {
                console.error("[Live Update] Subscription error:", err.message);
                if (!isPermissionDenied(err)) {
                    timer = setTimeout(() => setRetry((r) => r + 1), 15000);
                }
            },
        );

        return () => {
            unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, [homeId, authenticated, source, retry]);

    const value = {
        addDeviceTileCallback,
        addHomeDataSourceCallback,
    };

    return <LiveUpdateContext.Provider value={value}>{children}</LiveUpdateContext.Provider>;
};
