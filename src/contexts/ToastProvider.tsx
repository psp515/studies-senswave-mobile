import React, { createContext, useContext, FC, PropsWithChildren } from "react";
import RootToast from "react-native-root-toast";
import { useTheme } from "./ThemeProvider";
import { Keyboard } from "react-native";
import { toastTextFor, type FailedResultLike } from "@/api/toastDecision";

interface ToastContextType {
    success: (message: string) => void;
    info: (message: string) => void;
    error: (message: string) => void;
    /** `fallback` applies only when the result's errorMessage is empty. */
    apiError: (result: FailedResultLike, fallback?: string) => void;
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
        <ToastContext.Provider value={{ success, info, error, apiError }}>
            {children}
        </ToastContext.Provider>
    );
};
