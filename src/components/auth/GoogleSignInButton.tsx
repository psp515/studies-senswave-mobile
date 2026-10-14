import React, { useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import Icon from "../common/Icon";
import { useSession } from "@/contexts/SessionProvider";
import { useToast } from "@/contexts/ToastProvider";
import { useConfiguration } from "@/contexts/ConfigurationProvider";
import { useTheme } from "@/contexts/ThemeProvider";

const ICON_SIZE = 32;

const GoogleSignInButton: React.FC = () => {
    const theme = useTheme();
    const session = useSession();
    const toast = useToast();
    const configuration = useConfiguration();
    const [loading, setLoading] = useState(false);

    const onPress = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            await GoogleSignin.signOut();
            const userInfo = await GoogleSignin.signIn();

            if (userInfo["type"] === "cancelled") {
                console.info("User cancelled sign in with google.");
                return;
            }

            const serverAuthCode = userInfo["data"]?.["serverAuthCode"] ?? "";
            const result = await session.loginGoogle(serverAuthCode);

            if (result.isSuccess) {
                console.info("[Login Form] Google login successful.");
            } else {
                console.error("[Login Form] Google login failed.");
                toast.error(result.errorMessage!);
            }
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.warn("User cancelled the login flow");
            } else if (error.code === statusCodes.IN_PROGRESS) {
                console.warn("Sign-in in progress");
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                toast.error("Play Services not available or outdated");
            } else {
                console.error("Google Sign-In error", error);
                toast.error("Google Sign-In error");
            }
        } finally {
            setLoading(false);
        }
    };

    if (configuration.transportMode !== "Rest") return null;

    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
            style={({ pressed }) => ({ opacity: pressed && !loading ? 0.7 : 1 })}>
            {loading ? (
                <ActivityIndicator size={ICON_SIZE} color={theme.current.colors.textOnBackground} />
            ) : (
                <Icon icon="logo-google" size={ICON_SIZE} color="onBackground" />
            )}
        </Pressable>
    );
};

export default GoogleSignInButton;
