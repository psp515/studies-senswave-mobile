import React, {
    createContext,
    useEffect,
    useContext,
    PropsWithChildren,
    FC,
    useState,
    useRef,
} from "react";
import { useApi } from "../ApiProvider";
import { useToast } from "../ToastProvider";
import { call, isNotFound } from "@/api/call";
import { structToJson } from "@/api/json";
import { DashboardDisplayDto, ListDashboardDto } from "@/types/DeviceTypes";

export type { ListDashboardDto };

type DashhoardDto = DashboardDisplayDto;

interface DeviceContextProps {
    loading: boolean;
    deviceId: string;
    dashboards: ListDashboardDto[];
    currentDashboard?: DashhoardDto;
    currentDashboardId: string;
    setDeviceId: (id: string) => void;
    setCurrentDashboardId: (id: string) => void;
    refresh: (useLoading: boolean) => Promise<void>;
    smartRefresh: (incomingDeviceId: string) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextProps>({
    loading: false,
    deviceId: "",
    dashboards: [],
    currentDashboardId: "",
    currentDashboard: undefined,
    setDeviceId: () => {},
    setCurrentDashboardId: () => {},
    refresh: async () => {},
    smartRefresh: async () => {},
});

export const useDevice = () => useContext(DeviceContext);

const DeviceProvider: FC<PropsWithChildren> = ({ children }) => {
    const api = useApi();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [deviceId, setDeviceId] = useState("");
    const [dashboards, setDashboards] = useState<ListDashboardDto[]>([]);
    const [currentDashboardId, setCurrentDashboardId] = useState("");
    const [currentDashboard, setCurrentDashboard] = useState<DashhoardDto | undefined>(undefined);
    const currentDashboardIdRef = useRef(currentDashboardId);
    const deviceIdRef = useRef(deviceId);

    useEffect(() => {
        deviceIdRef.current = deviceId;
    }, [deviceId]);

    useEffect(() => {
        currentDashboardIdRef.current = currentDashboardId;
    }, [currentDashboardId]);

    const smartRefresh = async (incomingDeviceId: string) => {
        if (deviceIdRef.current === incomingDeviceId) {
            console.info(`[DeviceProvider] Data refresh for ${incomingDeviceId}.`);
            await baseLoadingLogic();
        } else {
            console.info(
                `[DeviceProvider] Data refresh skipped. Expected deviceId: ${deviceIdRef.current}, received: ${incomingDeviceId}`,
            );
        }
    };

    const baseLoadingLogic = async () => {
        const deviceId = deviceIdRef.current;
        const result = await call(() => api.dashboards.displayDashboards({ deviceId }));

        if (result.isSuccess) {
            const items: ListDashboardDto[] = (result.data?.items ?? []).map(
                ({ id, name, icon, type }) => ({ id, name, icon, type }),
            );
            setDashboards(items);

            if (items.length === 0) {
                setCurrentDashboardId("");
                console.info("[DeviceProvider] Refreshing resulted in no dashboards.");
                return;
            }

            let tmpDashboardId = currentDashboardIdRef.current;

            if (items.find((d) => d.id === currentDashboardIdRef.current) === undefined) {
                tmpDashboardId = items[0].id;
                console.info(`[DeviceProvider] Current dashboard not found in refreshed list.`);
            }

            const dashboardResult = await call(() =>
                api.dashboards.displayDashboard({ dashboardId: tmpDashboardId }),
            );

            if (dashboardResult.isSuccess) {
                const d = dashboardResult.data!;
                setCurrentDashboardId(tmpDashboardId);
                setCurrentDashboard({ type: d.type, configuration: structToJson(d.configuration) });
                console.info("[DeviceProvider] Fetched dashboard details.");
            } else {
                console.error(
                    "[DeviceProvider] Failed to fetch dashboard details.",
                    dashboardResult,
                );
            }

            console.info("[DeviceProvider] Fetched dashboards for device.");
        } else if (isNotFound(result)) {
            setDashboards([]);
            setCurrentDashboardId("");
            console.info("[DeviceProvider] No dashboards found for device.");
        } else {
            console.error("[DeviceProvider] Failed to fetch dashboards.", result);
            toast.apiError(result);
            setDashboards([]);
            setCurrentDashboardId("");
        }
    };

    const refresh = async (useLoading: boolean = true) => {
        if (deviceIdRef.current === "") {
            console.info("[DeviceProvider] Device Id is empty.");
            return;
        }

        if (loading) {
            console.info("[DeviceProvider] Already loading.");
            return;
        }

        if (useLoading) {
            setLoading(true);
        }

        await baseLoadingLogic();

        if (useLoading) {
            setLoading(false);
        }
    };

    const setDeviceIdHandler = (id: string) => {
        console.info("[DeviceProvider] Device Id set to: " + id);
        setDeviceId(id);
        deviceIdRef.current = id;
    };

    const setCurrentDashboardIdHandler = (id: string) => {
        console.info("[DeviceProvider] Current Dashboard Id set to: " + id);
        setCurrentDashboardId(id);
        currentDashboardIdRef.current = id;
    };

    useEffect(() => {
        if (deviceIdRef.current === "") {
            console.info("[DeviceProvider] Device Id is empty.");
            return;
        }

        const getDashboards = async () => {
            setLoading(true);
            const deviceId = deviceIdRef.current;
            const result = await call(() => api.dashboards.displayDashboards({ deviceId }));

            if (result.isSuccess) {
                const items: ListDashboardDto[] = (result.data?.items ?? []).map(
                    ({ id, name, icon, type }) => ({ id, name, icon, type }),
                );
                setDashboards(items);
                if (items.length > 0) {
                    setCurrentDashboardId(items[0].id);
                } else {
                    setCurrentDashboardId("");
                }
                console.info("[DeviceProvider] Fetched dashboards for device. In useEffect.");
            } else if (isNotFound(result)) {
                setDashboards([]);
                setCurrentDashboardId("");
                console.info("[DeviceProvider] No dashboards found for device.");
            } else {
                console.error("[DeviceProvider] Failed to fetch dashboards.", result);
                toast.apiError(result);
                setDashboards([]);
                setCurrentDashboardId("");
            }
            setLoading(false);
        };

        getDashboards();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceIdRef, deviceId]);

    useEffect(() => {
        const getDashboardDetails = async (id: string) => {
            setLoading(true);

            const result = await call(() => api.dashboards.displayDashboard({ dashboardId: id }));

            if (result.isSuccess) {
                const d = result.data!;
                setCurrentDashboard({ type: d.type, configuration: structToJson(d.configuration) });
                console.info("[DeviceProvider] Fetched dashboard details.");
            } else {
                console.error("[DeviceProvider] Failed to fetch dashboard details.", result);
            }

            setLoading(false);
        };

        if (currentDashboardIdRef.current) {
            getDashboardDetails(currentDashboardIdRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDashboardIdRef, currentDashboardId]);

    return (
        <DeviceContext.Provider
            value={{
                loading,
                dashboards,
                currentDashboard,
                currentDashboardId,
                setCurrentDashboardId: setCurrentDashboardIdHandler,
                deviceId,
                setDeviceId: setDeviceIdHandler,
                refresh,
                smartRefresh,
            }}>
            {children}
        </DeviceContext.Provider>
    );
};

export { DeviceProvider };
