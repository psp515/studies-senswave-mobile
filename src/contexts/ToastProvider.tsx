import React, { createContext, useContext, FC, PropsWithChildren } from "react";
import RootToast from "react-native-root-toast";
import { useTheme } from "./ThemeProvider";
import { HttpResponse } from "@/utils/httpClient";
import { Keyboard } from "react-native";
import { toastTextFor, type FailedResultLike } from "@/api/toastDecision";

interface ToastContextType {
    success: (message: string) => void;
    info: (message: string) => void;
    error: (message: string) => void;
    httpError: (message: HttpResponse) => void;
    apiError: (result: FailedResultLike, fallback?: string) => void;
}

interface ErrorDetail {
    code: string;
    type: number;
    description: string;
}

interface ResponseError {
    statusCode: number;
    title: string;
    type: string;
    errors: ErrorDetail[];
    traceId: string;
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

    const apiError = (result: FailedResultLike, fallback?: string) => {
        const text = toastTextFor(result, fallback);
        if (text) error(text);
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
            const response = JSON.parse(text) as ResponseError;

            if (response.errors && response.errors.length > 0) {
                const errorDetails = response.errors
                    .map(
                        (error: ErrorDetail) =>
                            `Code: ${error.code}, Type: ${error.type}, Description: ${error.description}`,
                    )
                    .join("\n");

                console.error(`[Http Error] Error type: ${response.type},
                    Status code: ${response.statusCode},
                    Title: ${response.title},
                    Details: ${errorDetails}`);

                const firstError = response.errors[0];
                error(firstError.description ? firstError.description : firstError.code);
            } else {
                error("An unexpected error occurred.");
            }
        } catch (e) {
            console.error(text);
            console.error(
                `[Toast Http Error] Failed to parse error response to ${httpResponse.response?.url}`,
                e,
            );
            error("An unexpected error occurred.");
        }
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
