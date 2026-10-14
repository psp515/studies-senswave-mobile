import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    PropsWithChildren,
    FC,
} from "react";
import { useApi } from "../ApiProvider";
import { useHomes } from "../domain/HomeProvider";
import { useToast } from "../ToastProvider";
import { call, isNotFound } from "@/api/call";
import { AutomationDto, toAutomationDto } from "@/types/AutomationsTypes";

interface AutomationListContextProps {
    loading: boolean;
    automations: AutomationDto[];

    refresh(): Promise<boolean>;
}

const AutomationListContext = createContext<AutomationListContextProps>({
    loading: false,
    automations: [],

    refresh: async () => {
        console.warn("refresh not implemented.");
        return false;
    },
});

export const useAutomationList = () => useContext(AutomationListContext);

const AutomationListProvider: FC<PropsWithChildren> = ({ children }) => {
    const homes = useHomes();
    const toast = useToast();
    const api = useApi();
    const [automations, setAutomations] = useState<AutomationDto[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    const fetchAutomations = async (): Promise<boolean> => {
        if (!homes.current?.id) {
            console.debug("[AutomationListProvider] No home selected.");
            return false;
        }
        const homeId = homes.current.id;
        const result = await call(() => api.automations.displayAutomations({ homeId }));
        if (result.isSuccess) {
            setAutomations(result.data!.items.map(toAutomationDto));
            console.info("[AutomationListProvider] Successfully fetched automations.");
            return true;
        } else if (isNotFound(result)) {
            console.warn("[AutomationListProvider] No automations found for the current home.");
            setAutomations([]);
            return false;
        } else {
            toast.apiError(result);
            setAutomations([]);
            return false;
        }
    };

    const refresh = async () => {
        setLoading(true);

        try {
            return fetchAutomations();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAutomations();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homes.current?.id]);

    console.info("[AutomationListProvider] Initialized.");

    return (
        <AutomationListContext.Provider
            value={{
                automations,
                loading,
                refresh,
            }}>
            {children}
        </AutomationListContext.Provider>
    );
};

export { AutomationListProvider, AutomationListContext };
