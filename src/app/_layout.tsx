import "react-native-gesture-handler";
import "react-native-reanimated";
import { SessionProvider } from "@/contexts/SessionProvider";
import { ThemeProvider, useTheme } from "@/contexts/ThemeProvider";
import { Slot } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { RootSiblingParent } from "react-native-root-siblings";
import { ToastProvider } from "@/contexts/ToastProvider";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ConfigurationProvider } from "@/contexts/ConfigurationProvider";
import { HttpClientProvider } from "@/contexts/HttpClientProvider";
import { ApiProvider } from "@/contexts/ApiProvider";
import { AnonymousApiProvider } from "@/contexts/AnonymousApiProvider";
import { UserProvider } from "@/contexts/domain/UserProvider";
import { LegalProvider } from "@/contexts/domain/LegalProvider";
import { SignalRProvider } from "@/contexts/SignalRProvider";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

function RootLayoutInner() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_API_GOOGLE_CLIENT_ID,
            offlineAccess: true,
            scopes: ["profile", "email", "openid"],
        });
    }, []);

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: theme.current.colors.background,
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
            }}>
            <Slot />
            <StatusBar backgroundColor={theme.current.colors.background} />
        </View>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <RootSiblingParent>
                <SafeAreaProvider>
                    <PaperProvider>
                        <KeyboardProvider>
                            <ToastProvider>
                                <ConfigurationProvider>
                                    <AnonymousApiProvider>
                                        <LegalProvider>
                                            <SessionProvider>
                                                <ThemeProvider>
                                                    <HttpClientProvider>
                                                        <ApiProvider>
                                                            <SignalRProvider>
                                                                <UserProvider>
                                                                    <RootLayoutInner />
                                                                </UserProvider>
                                                            </SignalRProvider>
                                                        </ApiProvider>
                                                    </HttpClientProvider>
                                                </ThemeProvider>
                                            </SessionProvider>
                                        </LegalProvider>
                                    </AnonymousApiProvider>
                                </ConfigurationProvider>
                            </ToastProvider>
                        </KeyboardProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </RootSiblingParent>
        </GestureHandlerRootView>
    );
}
