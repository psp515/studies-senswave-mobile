import {
    OperationDto,
    WidgetDto,
    WidgetType,
    toOperationDto,
    toWidgetDto,
} from "@/types/DeviceTypes";
import { call } from "@/api/call";
import React, { createContext, useContext, useState, useRef, ReactNode } from "react";
import { useApi } from "../ApiProvider";
import { useToast } from "../ToastProvider";

type AddWidgetDto = {
    operationId: string;

    name: string;
    type: WidgetType;

    configuration: any;
};

type WidgetBaseErrors = {
    nameError: string;
};

interface WidgetDetailsContextProps {
    loading: boolean;

    operation: OperationDto | undefined;
    widget: WidgetDto | undefined;
    errors: WidgetBaseErrors;
    setWidget: (widget: WidgetDto) => void;

    initializeForAdd: (operationId: string) => Promise<void>;
    initializeForDisplay: (widgetId: string) => Promise<void>;

    toAddDto: () => AddWidgetDto;
    isValid: boolean;
    setIsValid: (valid: boolean) => void;
    validateDto: () => boolean;
    setAdditionalValidation: (callback: () => boolean) => void;
}

const WidgetDetailsContext = createContext<WidgetDetailsContextProps>({
    loading: false,

    operation: undefined,

    widget: undefined,
    errors: { nameError: "" },
    setWidget: () => {},

    initializeForAdd: (): Promise<void> => {
        console.warn("[WidgetDetailsProvider] Initialize for add not implemented.");
        return Promise.resolve();
    },
    initializeForDisplay: (): Promise<void> => Promise.resolve(),

    toAddDto: (): AddWidgetDto => {
        return { operationId: "", name: "", type: "Invalid", configuration: {} };
    },
    isValid: false,
    setIsValid: () => {},
    validateDto: () => false,
    setAdditionalValidation: () => {
        console.warn("[WidgetDetailsProvider] Validation function set.");
    },
});

export const WidgetDetailsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const api = useApi();
    const toast = useToast();

    const [loading, setLoading] = useState<boolean>(false);

    const [operation, setOperation] = useState<OperationDto | undefined>(undefined);
    const [widget, setWidget] = useState<WidgetDto | undefined>(undefined);
    const [errors, setErrors] = useState<WidgetBaseErrors>({ nameError: "" });
    const [isValid, setIsValid] = useState<boolean>(false);

    const additionalValidateRef = useRef<(() => boolean) | null>(null);

    const initializeForAdd = async (operationId: string) => {
        if (loading) {
            console.info("[WidgetDetailsContext] Already processing.");
            return;
        }

        setLoading(true);

        const response = await call(() => api.operations.getOperation({ operationId }));

        if (response.isSuccess) {
            setOperation(toOperationDto(response.data!));
        } else {
            toast.apiError(response);
        }

        setWidget({
            id: "",
            deviceId: "",
            operationId: operationId,

            name: "",
            type: "Button",
            enabled: true,

            configuration: {},
        });

        setLoading(false);
    };

    const initializeForDisplay = async (widgetId: string) => {
        if (loading) {
            console.info("[WidgetDetailsContext] Already processing.");
            return;
        }

        setLoading(true);

        const widgetResponse = await call(() => api.widgets.getWidget({ widgetId }));

        let operationId = "";

        if (widgetResponse.isSuccess) {
            const content = toWidgetDto(widgetResponse.data!);
            operationId = content.operationId;
            setWidget(content);
        } else {
            toast.apiError(widgetResponse);
            setLoading(false);
            return;
        }

        const response = await call(() => api.operations.getOperation({ operationId }));

        if (response.isSuccess) {
            setOperation(toOperationDto(response.data!));
        } else {
            toast.apiError(response);
            setLoading(false);
            return;
        }

        setLoading(false);
    };

    const toAddDto = (): AddWidgetDto => {
        return {
            operationId: widget?.operationId ?? "",

            name: widget?.name ?? "",
            type: widget?.type ?? "Invalid",

            configuration: widget?.configuration ?? {},
        };
    };

    const validateDto = () => {
        console.info("[WidgetDetailsProvider] Validating.");

        let valid = true;

        const name = widget?.name ?? "";

        if (name === "") {
            valid = false;
            setErrors({ ...errors, nameError: "" });
        } else if (name.length > 64) {
            valid = false;
            setErrors({ ...errors, nameError: "Name is too long." });
        } else if (name.length < 3) {
            valid = false;
            setErrors({ ...errors, nameError: "Name is too short." });
        } else {
            setErrors({ ...errors, nameError: "" });
        }

        if (additionalValidateRef.current) {
            const additionalValid = additionalValidateRef.current();
            valid = additionalValid && valid;

            console.info("[WidgetDetailsProvider] Additional validation result:", additionalValid);
        } else {
            console.warn("[WidgetDetailsProvider] No additional validation function set.");
        }

        setIsValid(valid);

        return valid;
    };

    const setAdditionalValidation = (callback: () => boolean) => {
        additionalValidateRef.current = () => {
            return callback();
        };
    };

    console.info("[WidgetDetailsProvider] Initialized.");

    return (
        <WidgetDetailsContext.Provider
            value={{
                loading,
                operation,
                errors,
                widget,
                setWidget,
                initializeForAdd,
                initializeForDisplay,
                toAddDto,
                isValid,
                setIsValid,
                validateDto,
                setAdditionalValidation,
            }}>
            {children}
        </WidgetDetailsContext.Provider>
    );
};

export const useWidgetDetails = () => useContext(WidgetDetailsContext);
