import React, { FC, PropsWithChildren, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect } from "react";
import { call, callSimple } from "@/api/call";
import { identityValidationFailure, isServerFailure, loginFailure } from "@/api/authErrors";
import type { AccessTokenResponse } from "@/api/gen/users/v1/auth_pb";
import { executeTimeout } from "@/utils/httpClient";
import { Result, SimpleResult } from "@/utils/result";
import { Code } from "@connectrpc/connect";
import { useAnonymousApi } from "./AnonymousApiProvider";
import { useConfiguration } from "./ConfigurationProvider";

const RememberMeName: string = "rememberMe";
const RememberedValue: string = "remembered";
const RefreshTokenName: string = "refreshToken";
const AccessTokenName: string = "accessToken";

type Tokens = {
    tokenType: string;
    refreshToken: string;
    accessToken: string;
};

const toTokens = (r: AccessTokenResponse): Tokens => ({
    tokenType: r.tokenType,
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
});

type Session = {
    loading: boolean;
    authenticated: boolean;
    refreshToken: string;
    accessToken: string;
};

const Unauthenticated: Session = {
    loading: false,
    authenticated: false,
    accessToken: "",
    refreshToken: "",
};

const Initialized: Session = {
    loading: true,
    authenticated: false,
    refreshToken: "",
    accessToken: "",
};

interface SessionProperties {
    maintenance: boolean;
    session: Session;
    rememberMe: boolean;
    toogleRememberMe: () => Promise<void>;

    confirmEmail: (userId: string, code: string) => Promise<SimpleResult>;
    refresh: () => Promise<string | null>;
    login: (username: string, password: string) => Promise<Result<boolean>>;
    loginGoogle: (code: string) => Promise<SimpleResult>;
    logout: () => void;
    resendEmailConfirmationMessage: (email: string) => Promise<SimpleResult>;

    register: (email: string, password: string) => Promise<SimpleResult>;
    forgotPassword: (email: string) => Promise<SimpleResult>;
    resetPassword: (email: string, password: string, resetCode: string) => Promise<SimpleResult>;

    initialize: () => Promise<void>;
}

const SessionContext = createContext<SessionProperties>({
    maintenance: false,
    session: Initialized,
    rememberMe: false,
    toogleRememberMe: async () => {},

    confirmEmail: async () => SimpleResult.failure("Context not initialized"),

    refresh: async () => null,
    login: async () => Result.failure("Context not initialized"),
    loginGoogle: async () => SimpleResult.failure("Context not initialized"),

    resendEmailConfirmationMessage: async () => SimpleResult.failure("Context not initialized"),

    logout: () => {},

    register: async () => SimpleResult.failure("Context not initialized"),
    forgotPassword: async () => SimpleResult.failure("Context not initialized"),
    resetPassword: async () => SimpleResult.failure("Context not initialized"),

    initialize: async () => {},
});

export const useSession = () => useContext(SessionContext);

export const SessionProvider: FC<PropsWithChildren> = ({ children }) => {
    const router = useRouter();
    const configuration = useConfiguration();
    const api = useAnonymousApi();
    const apiRef = useRef(api);
    apiRef.current = api;
    const refreshInFlight = useRef<Promise<string | null> | null>(null);

    const [session, setSession] = useState<Session>(Initialized);
    const [rememberMe, setRememberMe] = useState(false);
    const [maintenance, setMaintenance] = useState(false);

    const resendEmailConfirmationMessage = async (email: string): Promise<SimpleResult> => {
        const result = await callSimple(
            () => api.auth.resendConfirmationEmail({ email }),
            "Failed to resend confirmation email",
        );

        if (result.isSuccess) {
            console.info("[Session Provider] Confirmation email was resend.");
            return result;
        }

        if (result.error && isServerFailure(result.error)) {
            console.error("[Session Provider] Server not available to handle request.");
            return SimpleResult.failure("Server not available", result.error);
        }

        console.error("[Session Provider] Failed to resend confirmation email.");
        return result;
    };

    const confirmEmail = async (userId: string, code: string): Promise<SimpleResult> => {
        try {
            const result = await callSimple(
                () => api.auth.confirmEmail({ userId, code }),
                "Failed to confirm email.",
            );

            if (result.isSuccess) {
                console.debug("[Session Provider] Email confirmed successfully.");
                return result;
            }

            console.debug(`[Session Provider] Confirm email failed: ${result.error?.code}`);
            return SimpleResult.failure("Failed to confirm email.", result.error);
        } catch (error) {
            console.error(`[Session Provider] Confirm email error: ${error}`);
            return SimpleResult.failure("Confirm email failed unexpectedly.");
        }
    };

    const toogleRememberMe = async (): Promise<void> => {
        if (rememberMe) {
            await SecureStore.deleteItemAsync(RememberMeName);
            await SecureStore.deleteItemAsync(AccessTokenName);
            await SecureStore.deleteItemAsync(RefreshTokenName);
            setRememberMe(false);
            console.debug("[Session Provider] User data will not be remembered.");
            return;
        } else {
            console.debug("[Session Provider] User data will be remembered.");
            await SecureStore.setItemAsync(RememberMeName, RememberedValue);
            setRememberMe(true);
        }
    };

    const successfulLogin = async (data: Tokens, forceRememberMe: boolean = false) => {
        if (data.tokenType !== "Bearer") {
            console.error(`[Session Provider] Unexpected token type: ${data.tokenType}`);
            setSession(Unauthenticated);
            return SimpleResult.failure("Login failed unexpectedly. Plase update app.");
        }

        if (forceRememberMe) {
            await SecureStore.setItemAsync(RememberMeName, RememberedValue);
        }

        if (rememberMe || forceRememberMe) {
            console.debug("[Session Provider] User stored.");
            await SecureStore.setItemAsync(AccessTokenName, data.accessToken);
            await SecureStore.setItemAsync(RefreshTokenName, data.refreshToken);
        }

        setSession({
            loading: false,
            authenticated: true,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        });

        console.debug("[Session Provider] User logged in successfully.");
        router.replace({ pathname: "/consents" });
    };

    // Returns if we need to display rsend confirmation email button
    const login = async (email: string, password: string): Promise<Result<boolean>> => {
        try {
            setSession({ ...session, loading: true });

            const result = await call(() => api.auth.login({ email, password }));

            if (result.isSuccess) {
                successfulLogin(toTokens(result.data!));
                return Result.success<boolean>(false);
            }

            setSession(Unauthenticated);
            console.debug(`[Session Provider] Login failed: ${result.error?.code}`);
            return loginFailure(result.error);
        } catch (error) {
            console.error(`[Session Provider] Login error: ${error}`);
            setSession(Unauthenticated);
        }

        console.debug("[Session Provider] Unexpected fail during login.");
        return Result.failureWithData<boolean>("Login failed unexpectedly.", false);
    };

    const loginGoogle = async (code: string): Promise<SimpleResult> => {
        try {
            const url = configuration.getApiUrl("v1/auth/login/google");

            const body = JSON.stringify({ code });
            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    accept: "application/json",
                },
                body,
            };

            const result = await executeTimeout(url, options);

            if (result.isSuccess) {
                const data: Tokens = await result.response!.json();
                successfulLogin(data, true);
                return SimpleResult.success();
            }

            setSession(Unauthenticated);
            console.debug(`[Session Provider] Login failed with status code ${result.statusCode}`);

            if (result.statusCode === 400) {
                return SimpleResult.failure("Failed to login with google.");
            }

            if (result.statusCode === 500) {
                return SimpleResult.failure("Server not available.");
            }
        } catch (error) {
            console.error(`[Session Provider] Google login error: ${error}`);
            setSession(Unauthenticated);
        }

        return SimpleResult.failure("Google login failed.");
    };

    const doRefresh = async (): Promise<string | null> => {
        try {
            if (!session.refreshToken) {
                setSession(Unauthenticated);
                return null;
            }

            const result = await call(() =>
                apiRef.current.auth.refresh({ refreshToken: session.refreshToken }),
            );

            if (result.isSuccess) {
                console.debug("[Session Provider] Token refreshed successfully");

                const data = toTokens(result.data!);

                await SecureStore.setItemAsync(AccessTokenName, data.accessToken);
                await SecureStore.setItemAsync(RefreshTokenName, data.refreshToken);
                setSession({
                    loading: false,
                    authenticated: true,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                });

                return data.accessToken;
            }

            if (result.error?.code === Code.Unauthenticated) {
                setSession(Unauthenticated);
                router.replace("start");
                console.error("[Session Provider] Refresh token invalid, logging out.");
                return null;
            }

            // Network/server error - preserve session, let caller decide
            setSession((s) => ({ ...s, loading: false }));
            console.warn(`[Session Provider] Refresh error: ${result.error?.code}`);
            return null;
        } catch (error) {
            setSession((s) => ({ ...s, loading: false }));
            console.error(`[Session Provider] Unexpected error when refreshing tokens. ${error}`);
            return null;
        }
    };

    // Concurrent callers (legacy HttpClient and ApiProvider) share one in-flight refresh.
    const refresh = (): Promise<string | null> => {
        if (refreshInFlight.current) {
            return refreshInFlight.current;
        }

        const promise = doRefresh().finally(() => {
            refreshInFlight.current = null;
        });
        refreshInFlight.current = promise;
        return promise;
    };

    const logout = () => {
        SecureStore.deleteItemAsync(AccessTokenName);
        SecureStore.deleteItemAsync(RefreshTokenName);
        setSession(Unauthenticated);
        router.replace("start");
    };

    const register = async (email: string, password: string): Promise<SimpleResult> => {
        try {
            setSession({ ...session, loading: true });

            const result = await callSimple(() => api.auth.register({ email, password }));

            if (result.isSuccess) {
                console.debug("[Session Provider] User registered successfully.");
                return result;
            }

            console.debug(`[Session Provider] Registration failed: ${result.error?.code}`);
            return identityValidationFailure(result.error, "Registration failed unexpectedly.");
        } catch (error) {
            console.error(`[Session Provider] Registration error: ${error}`);
        } finally {
            setSession({ ...session, loading: false });
        }

        return SimpleResult.failure("Registration failed unexpectedly.");
    };

    const forgotPassword = async (email: string): Promise<SimpleResult> => {
        try {
            setSession({ ...session, loading: true });

            const result = await callSimple(
                () => api.auth.forgotPassword({ email }),
                "Forgot password failed unexpectedly.",
            );

            if (result.isSuccess) {
                console.debug("[Session Provider] Forgot password email sent successfully.");
                return result;
            }

            console.error(`[Session Provider] Forgot password failed: ${result.error?.code}`);
            return SimpleResult.failure("Forgot password failed unexpectedly.", result.error);
        } catch (error) {
            console.error(
                `[Session Provider] Unexpected exception when sending forgot password email ${error}`,
            );
        } finally {
            setSession({ ...session, loading: false });
        }
        return SimpleResult.failure("Forgot password failed unexpectedly.");
    };

    const resetPassword = async (
        email: string,
        password: string,
        resetCode: string,
    ): Promise<SimpleResult> => {
        try {
            setSession({ ...session, loading: true });

            const result = await callSimple(() =>
                api.auth.resetPassword({ email, resetCode, newPassword: password }),
            );

            if (result.isSuccess) {
                console.debug("[Session Provider] Password reset successfully.");
                return result;
            }

            console.error(`[Session Provider] Reset password failed: ${result.error?.code}`);
            return identityValidationFailure(result.error, "Reset password failed unexpectedly.");
        } catch (error) {
            console.error(
                `[Session Provider] Unexpected exception when resetting password ${error}`,
            );
        } finally {
            setSession({ ...session, loading: false });
        }

        return SimpleResult.failure("Reset password failed unexpectedly.");
    };

    const initialize = async () => {
        try {
            const isCompatible = await configuration.isAppCompatibleWithApi();

            if (!isCompatible) {
                console.info("[Session Provider] Forcing upgrade on user.");
                setMaintenance(true);
                setSession(Unauthenticated);
                return;
            }

            setMaintenance(false);

            const rememberMeString = await SecureStore.getItemAsync(RememberMeName);

            console.debug(`[Session Provider] Remember me: ${rememberMeString} `);

            if (!(rememberMeString === RememberedValue)) {
                console.debug("[Session Provider] User not remembered.");
                //router.replace("start")
                setSession(Unauthenticated);
                return;
            }

            const refreshToken = await SecureStore.getItemAsync(RefreshTokenName);

            if (!refreshToken) {
                console.debug("[Session Provider] No refresh token stored.");
                //router.replace("start")
                setSession(Unauthenticated);
                return;
            }

            const result = await call(() => apiRef.current.auth.refresh({ refreshToken }));

            if (result.isSuccess) {
                console.debug("[Session Provider] Token refreshed successfully");
                await successfulLogin(toTokens(result.data!));
                return;
            }

            console.error(`[Session Provider] Refresh failed: ${result.error?.code}`);

            setSession({ ...session, loading: false });
        } catch (error) {
            setSession(Unauthenticated);
            console.error(`[Session Provider] Unexpected exception when refreshing token ${error}`);
        }
    };

    useEffect(() => {
        initialize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SessionContext.Provider
            value={{
                maintenance,
                session,
                rememberMe,
                toogleRememberMe,
                login,
                loginGoogle,
                refresh,
                logout,
                register,
                forgotPassword,
                resetPassword,
                confirmEmail,
                resendEmailConfirmationMessage,
                initialize,
            }}>
            {children}
        </SessionContext.Provider>
    );
};
