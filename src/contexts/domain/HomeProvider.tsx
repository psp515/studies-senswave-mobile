import React, { createContext, useState, useContext, ReactNode, FC, useEffect } from "react";
import { Code } from "@connectrpc/connect";
import { call } from "@/api/call";
import { useApi } from "../ApiProvider";
import { useToast } from "../ToastProvider";
import { Home, toHome } from "@/types/HomeTypes";
import { getCurrentLocation } from "@/utils/location";

interface HomesContextProps {
    loading: boolean;
    current: Home | undefined;
    setCurrent: (homeId: string) => Promise<boolean>;
    refreshCurrent: () => Promise<void>;
    refreshRooms: () => Promise<void>;
    initializeCurrentHome: () => Promise<boolean>;
    updateHomeDataSourceState: (dataSourceId: string, state: string) => Promise<void>;
}

const HomesContext = createContext<HomesContextProps>({
    loading: true,
    current: undefined,
    setCurrent: async () => {
        console.error("[HomesContext] Not initialized.");
        return false;
    },
    refreshRooms: async () => {
        console.error("[HomesContext] Not initialized.");
    },
    initializeCurrentHome: async () => {
        console.error("[HomesContext] Not initialized.");
        return false;
    },
    refreshCurrent: async () => {
        console.error("[HomesContext] Not initialized.");
    },
    updateHomeDataSourceState: async () => {
        console.error("[HomesContext] Not initialized.");
    },
});

export const useHomes = (): HomesContextProps => useContext(HomesContext);

export const HomeProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const toast = useToast();
    const api = useApi();
    const [loading, setLoading] = useState<boolean>(true);
    const [currentHome, setCurrentHome] = useState<Home | undefined>(undefined);

    const setCurrent = async (homeId: string) => {
        const result = await call(() => api.homes.getHome({ homeId }));

        if (result.isSuccess) {
            setCurrentHome(toHome(result.data!));
            console.info("[HomesProvider] Current home loaded.");
            return true;
        } else {
            console.error("[HomesProvider] Failed to set current home.");
            return false;
        }
    };

    const refreshRooms = async () => {
        console.info("[HomesProvider] Triggering rooms refresh.");

        if (!currentHome?.id) {
            console.debug("[Rooms View] No home selected.");
            return;
        }

        const homeId = currentHome.id;
        const result = await call(() => api.rooms.displayRooms({ homeId }));

        if (result.isSuccess) {
            const rooms = result.data!.items.map(({ id, name }) => ({ id, name }));

            setCurrentHome((prev) => ({
                ...prev!,
                rooms,
            }));

            console.debug("[Rooms View] Rooms refreshed.");
        } else if (result.error?.code === Code.NotFound) {
            console.debug("[Rooms View] No rooms found.");
            setCurrentHome((prev) => ({
                ...prev!,
                rooms: [],
            }));
        } else {
            toast.apiError(result);
        }
    };

    const initializeCurrentHome = async () => {
        const currentLocation = await getCurrentLocation();
        setLoading(true);

        const latitude = currentLocation?.latitude;
        const longitude = currentLocation?.longitude;

        const current = await call(() => api.homes.getCurrentHome({ latitude, longitude }));

        if (!current.isSuccess) {
            if (current.error?.code === Code.NotFound) {
                toast.info("Create your first home!");
                console.info("[HomesProvider] Homes not found.");
                setCurrentHome(undefined);
            } else {
                toast.apiError(current);
            }
            setLoading(false);
            return false;
        }

        const homeId = current.data!.id;
        const homeResult = await call(() => api.homes.getHome({ homeId }));

        if (homeResult.isSuccess) {
            setCurrentHome(toHome(homeResult.data!));
            console.info("[HomesProvider] Current home loaded.");
            setLoading(false);
            return true;
        } else {
            toast.apiError(homeResult);
            setLoading(false);
            return false;
        }
    };

    const refreshCurrent = async () => {
        setLoading(true);

        const homeId = currentHome?.id ?? "";
        const result = await call(() => api.homes.getHome({ homeId }));

        if (result.isSuccess) {
            setCurrentHome(toHome(result.data!));
            console.info("[HomesProvider] Current home loaded.");
        } else {
            console.error("[HomesProvider] Failed to set current home.");
        }
        setLoading(false);
    };

    const updateHomeDataSourceState = async (dataSourceId: string, state: string) => {
        if (currentHome?.dataSource?.id === dataSourceId) {
            setCurrentHome((prev) => ({
                ...prev!,
                dataSource: {
                    ...prev!.dataSource!,
                    state: state,
                },
            }));
            console.info(
                "[HomesProvider] Home data source state updated. DataSource:" +
                    dataSourceId +
                    " New state: " +
                    state,
            );
        } else {
            console.info(
                "[HomesProvider] Data source ID does not match current home's data source. No update performed. Current: " +
                    currentHome?.dataSource?.id +
                    ", Given: " +
                    dataSourceId,
            );
        }
    };

    useEffect(() => {
        initializeCurrentHome();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <HomesContext.Provider
            value={{
                loading: loading,
                current: currentHome,
                setCurrent,
                refreshRooms,
                initializeCurrentHome,
                refreshCurrent,
                updateHomeDataSourceState,
            }}>
            {children}
        </HomesContext.Provider>
    );
};
