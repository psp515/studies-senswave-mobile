import React, { createContext, useContext, FC, PropsWithChildren } from "react";
import RootToast from "react-native-root-toast";
import { useTheme } from "./ThemeProvider";
import { HttpResponse } from "@/utils/httpClient";
import { Keyboard } from "react-native";
import { ApiError, apiErrorMessage } from "@/api/apiError";
import { apiErrorFromProblemDetails } from "@/api/rest/problemDetails";

interface ToastContextType {
    success: (message: string) => void;
    info: (message: string) => void;
    error: (message: string) => void;
    httpError: (message: HttpResponse) => void;
    apiError: (error: ApiError) => void;
}

const ToastContext = createContext<ToastContextType>({
    success: () => {
        console.debug("[Toast Context] Not initialized.");
    },
    error: () => {
        console.debug("[Toast Context] Not initialized.");
    },
    info: () => {
        console.debug("[Toast Context] Not initialized.");
    },
    httpError: () => {
        console.debug("[Toast Context] Not initialized.");
    },
    apiError: () => {
        console.debug("[Toast Context] Not initialized.");
    },
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: FC<PropsWithChildren> = ({ children }) => {
    const theme = useTheme();

    const success = (message: string) => {
        Keyboard.dismiss();
        RootToast.show(message, {
            position: RootToast.positions.BOTTOM,
            duration: 4000,
            backgroundColor: theme.current.colors.success,
            textColor: theme.current.colors.secondary,
            shadow: true,
        });
    };

    const error = (message: string) => {
        Keyboard.dismiss();
        RootToast.show(message, {
            position: RootToast.positions.BOTTOM,
            duration: 4000,
            backgroundColor: theme.current.colors.error,
            textColor: theme.current.colors.secondary,
            shadow: true,
        });
    };

    const apiError = (apiErr: ApiError) => {
        const details = apiErr.errors
            .map((e) => `Code: ${e.code}, Description: ${e.description}`)
            .join("\n");

        console.error(
            `[Api Error] Status: ${apiErr.statusText}, Trace: ${apiErr.traceId ?? "-"}, Details: ${details}`,
        );

        error(apiErrorMessage(apiErr));
    };

    const httpError = async (httpResponse: HttpResponse) => {
        if (httpResponse.statusCode === 401) return;

        if (httpResponse.response === null) {
            error("Connection error. Please check your internet connection.");
            return;
        }

        let text: string | undefined;
        try {
            text = await httpResponse.response.text();
        } catch (e) {
            console.error(
                `[Toast Http Error] Failed to read error response from ${httpResponse.response?.url}`,
                e,
            );
            error("An unexpected error occurred.");
            return;
        }

        const parsed = apiErrorFromProblemDetails(text);

        if (!parsed) {
            console.error(
                `[Toast Http Error] Failed to parse error response from ${httpResponse.response?.url}`,
                text,
            );
            error("An unexpected error occurred.");
            return;
        }

        apiError(parsed);
    };

    const info = (message: string) => {
        Keyboard.dismiss();
        RootToast.show(message, {
            position: RootToast.positions.BOTTOM,
            duration: 4000,
            backgroundColor: theme.current.colors.info,
            textColor: theme.current.colors.primary,
            shadow: true,
        });
    };

    return (
        <ToastContext.Provider value={{ success, info, error, httpError, apiError }}>
            {children}
        </ToastContext.Provider>
    );
};
