import React from "react";
import { Result, SimpleResult } from "@/utils/result";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { call, callSimple } from "@/api/call";
import { useApi } from "../ApiProvider";
import { useToast } from "../ToastProvider";
import { useTheme } from "../ThemeProvider";
import { useSession } from "../SessionProvider";

export enum ThemeMode {
    Light = "light",
    Dark = "dark",
    Default = "default",
}

interface UserData {
    language: string;
    theme: ThemeMode;
    email: string;
    name: string;
    image?: string;
    hasActiveConsent?: boolean;
}

interface UserProperties {
    data: UserData;
    updateTheme: (theme: ThemeMode) => Promise<SimpleResult>;
    updateLanguage: (language: string) => Promise<SimpleResult>;
    makeConsents: () => Promise<SimpleResult>;
    getUserData: () => Promise<Result<UserData>>;
    removeUserAccount: () => Promise<SimpleResult>;
}

const UserContext = createContext<UserProperties>({
    data: { language: "en", theme: ThemeMode.Default, email: "", name: "" },
    updateTheme: async () => SimpleResult.failure("Not implemented."),
    updateLanguage: async () => SimpleResult.failure("Not implemented."),
    makeConsents: async () => SimpleResult.failure("Not implemented."),
    getUserData: async () => Result.failure("Not implemented."),
    removeUserAccount: async () => SimpleResult.failure("NotImplemented"),
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: any) => {
    const api = useApi();
    const toast = useToast();
    const theme = useTheme();
    const session = useSession();

    const [userData, setUserData] = useState<UserData>({
        language: "en",
        theme: ThemeMode.Light,
        email: "",
        name: "",
        hasActiveConsent: false,
    });

    const updateThemeInternal = async (internalTheme: ThemeMode) => {
        if (internalTheme === ThemeMode.Default) {
            await theme.resetTheme();
        } else if (internalTheme === ThemeMode.Light) {
            await theme.lightTheme();
        } else {
            await theme.darkTheme();
        }
    };

    const updateTheme = async (internalTheme: ThemeMode) => {
        console.debug("[User provider] Updating theme...");

        const result = await callSimple(
            () => api.users.updateSettings({ theme: internalTheme }),
            "Failed to update theme.",
        );

        if (result.isSuccess) {
            setUserData({ ...userData, theme: internalTheme });
            updateThemeInternal(internalTheme);
            return SimpleResult.success();
        } else {
            toast.apiError(result);
            return SimpleResult.failure("Failed to update theme.", result.error);
        }
    };

    const updateLanguage = async (language: string) => {
        console.debug("[User provider] Updating language...");

        const result = await callSimple(
            () => api.users.updateSettings({ language }),
            "Failed to update language.",
        );

        if (result.isSuccess) {
            setUserData({ ...userData, language: language });
            return SimpleResult.success();
        } else {
            toast.apiError(result);
            return SimpleResult.failure("Failed to update language.", result.error);
        }
    };

    const makeConsents = async () => {
        console.debug("[User provider] Making consents...");

        const result = await callSimple(
            () => api.users.createConsents({}),
            "Failed to make consents.",
        );

        if (result.isSuccess) {
            console.debug("[User provider] Consents made.");
            return SimpleResult.success();
        } else {
            toast.apiError(result);
            return SimpleResult.failure("Failed to make consents.", result.error);
        }
    };

    const getUserData = async () => {
        const result = await call(() => api.users.getUser({}), "Failed to update.");

        if (result.isSuccess) {
            console.debug("[User Provider] User data loaded.");

            const data = result.data!;
            const themeMode = Object.values(ThemeMode).includes(data.theme as ThemeMode)
                ? (data.theme as ThemeMode)
                : ThemeMode.Default;
            updateThemeInternal(themeMode);
            const name = data.email.charAt(0).toUpperCase() + data.email.split("@")[0].slice(1);

            const userData: UserData = {
                theme: themeMode,
                language: data.language,
                email: data.email,
                name: name,
                hasActiveConsent: data.hasActiveConsent,
            };

            setUserData(userData);

            return Result.success<UserData>(userData);
        } else {
            toast.apiError(result);

            return Result.failure<UserData>("Failed to update.", result.error);
        }
    };

    const removeUserAccount = async () => {
        try {
            const result = await callSimple(
                () => api.users.deleteAccount({}),
                "Failed to remove account.",
            );

            if (result.isSuccess) {
                console.debug("[Session Provider] Account removed successfully.");
                session.logout();
                return SimpleResult.success();
            }

            toast.apiError(result);
            return SimpleResult.failure("Failed to remove account.", result.error);
        } catch (error) {
            console.error(`[Session Provider] Unexpected exception when removing account ${error}`);

            return SimpleResult.failure("Unexpected exrror when removing account.");
        }
    };

    useEffect(() => {
        if (session.session.authenticated) {
            getUserData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.session.authenticated]);

    const values = useMemo(
        () => ({
            data: userData,
            updateTheme: updateTheme,
            updateLanguage: updateLanguage,
            makeConsents: makeConsents,
            getUserData: getUserData,
            removeUserAccount: removeUserAccount,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [userData],
    );

    console.debug("[User Provider] Intialized.");

    return <UserContext.Provider value={values}>{children}</UserContext.Provider>;
};
