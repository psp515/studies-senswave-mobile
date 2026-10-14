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
import {
    AutomationResultDto,
    AutomationConditionDto,
    toAutomationDto,
} from "@/types/AutomationsTypes";

interface AutomationContextProps {
    automationId?: string;
    loading: boolean;

    results: AutomationResultDto[];
    setAutomationId: (id: string | undefined) => void;
    addResult: (result: AutomationResultDto) => Promise<void>;
    setAutomationResults: (results: AutomationResultDto[]) => void;
    removeResult: (resultId: string) => Promise<void>;

    conditions: AutomationConditionDto[];
    addCondition: (condition: AutomationConditionDto) => Promise<void>;
    setAutomationConditions: (conditions: AutomationConditionDto[]) => void;
    removeCondition: (conditionId: string) => Promise<void>;
}

const AutomationContext = createContext<AutomationContextProps>({
    automationId: undefined,
    loading: false,

    results: [],
    setAutomationId: () => {},
    addResult: async () => {},
    removeResult: async () => {},
    setAutomationResults: () => {},

    conditions: [],
    addCondition: async () => {},
    setAutomationConditions: () => {},
    removeCondition: async () => {},
});

export const useAutomation = () => useContext(AutomationContext);

const AutomationProvider: FC<PropsWithChildren> = ({ children }) => {
    const api = useApi();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<AutomationResultDto[]>([]);
    const [conditions, setConditions] = useState<AutomationConditionDto[]>([]);

    const [automationId, setAutomationIdState] = useState<string | undefined>(undefined);
    const automationIdRef = useRef<string | undefined>(undefined);

    const addResult = async (result: AutomationResultDto) => {
        console.info("[AutomationProvider] Adding result to automation");
        setResults((prev) => [...prev, result]);
    };

    const removeResult = async (resultId: string) => {
        console.info("[AutomationProvider] Removing result with id: ", resultId);
        setResults((prev) => prev.filter((result) => result.operationId !== resultId));
    };

    const setAutomationResults = (results: AutomationResultDto[]) => {
        console.info("[AutomationProvider] Setting automation results: ");
        setResults(results);
    };

    const addCondition = async (condition: AutomationConditionDto) => {
        console.info("[AutomationProvider] Adding condition to automation");
        setConditions((prev) => [...prev, condition]);
    };

    const removeCondition = async (conditionId: string) => {
        console.info("[AutomationProvider] Removing condition with id: ", conditionId);
        setConditions((prev) => prev.filter((condition) => condition.operationId !== conditionId));
    };

    const setAutomationConditions = (conditions: AutomationConditionDto[]) => {
        console.info("[AutomationProvider] Setting automation conditions");
        setConditions(conditions);
    };

    const setAutomationId = (id: string | undefined) => {
        console.info("[AutomationProvider] Setting automation id: ", id);
        setAutomationIdState(id);
        automationIdRef.current = id;
    };

    useEffect(() => {
        if (automationIdRef.current === undefined) {
            console.info("[AutomationProvider] Automation Id is empty.");
            setResults([]);
            setConditions([]);
            return;
        }

        const getAutomation = async () => {
            setLoading(true);
            const automationId = automationIdRef.current!;
            const result = await call(() => api.automations.getAutomation({ automationId }));

            if (result.isSuccess) {
                const content = toAutomationDto(result.data!.automation!);
                setResults(content.results ?? []);
                setConditions(content.conditions ?? []);
            } else if (isNotFound(result)) {
                setResults([]);
                setConditions([]);
                console.info("[AutomationProvider] No automation found.");
            } else {
                console.error("[AutomationProvider] Failed to fetch automation.", result);
                toast.apiError(result);
                setResults([]);
                setConditions([]);
            }
            setLoading(false);
        };

        getAutomation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [automationIdRef.current, automationId]);

    return (
        <AutomationContext.Provider
            value={{
                loading,
                automationId,
                setAutomationId,

                results,
                addResult,
                setAutomationResults,
                removeResult,

                conditions,
                addCondition,
                setAutomationConditions,
                removeCondition,
            }}>
            {children}
        </AutomationContext.Provider>
    );
};

export default AutomationProvider;
