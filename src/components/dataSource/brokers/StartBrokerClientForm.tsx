import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import PasswordInput from "@/components/common/PasswordInput";
import { Switch } from "@/components/common/Switch";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FC } from "react";
import { View } from "react-native";
import Text from "@/components/common/Text";
import * as SecureStore from "expo-secure-store";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { keyboardOffset } from "@/styles/defaultStyles";
import UserNote from "@/components/common/UserNote";

interface StartBrokerClientFormProps {
    brokerId: string;
}

const credentialCacheKey = (brokerId: string) => `brokerClientCredentials-${brokerId}`;

const StartBrokerClientForm: FC<StartBrokerClientFormProps> = ({
    brokerId,
}: StartBrokerClientFormProps) => {
    const api = useApi();
    const toast = useToast();
    const router = useRouter();
    const homes = useHomes();

    const [loading, setLoading] = useState<boolean>(false);

    const [username, setUsername] = useState("");
    const [usernameError, setUsernameError] = useState("");

    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const [rememberCredentials, setRememberCredentials] = useState<boolean>(false);

    const manageCredentials = async () => {
        if (rememberCredentials) {
            console.debug("[Start Broker Client Page] Saving credentials to secure storage.");
            await SecureStore.setItemAsync(
                credentialCacheKey(brokerId),
                JSON.stringify({ username, password }),
            );
        } else {
            console.debug("[Start Broker Client Page] Removing credentials from secure storage.");
            await SecureStore.deleteItemAsync(credentialCacheKey(brokerId));
        }
    };

    const submitClicked = async () => {
        setLoading(true);

        if (!validateForm()) {
            console.info("[Start Broker Client Page] Form is not valid.");
            setLoading(false);
            return;
        }

        await manageCredentials();

        try {
            const result = await callSimple(
                () => api.dataSources.startClient({ brokerId, username, password }),
                "Failed to start broker client.",
            );
            if (result.isSuccess) {
                console.info("[Start Broker Client Page] Started broker client.");
                await homes.refreshCurrent();
                toast.success("Broker client started successfully.");
                router.back();
            } else {
                console.info("[Start Broker Client Page] Failed to start broker client.");
                toast.apiError(result);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        let valid = true;

        if (username === "") {
            valid = false;
            setUsernameError("");
        } else if (username.length > 128) {
            valid = false;
            setUsernameError("Username is too long.");
        } else if (username.length < 3) {
            valid = false;
            setUsernameError("Username is too short.");
        } else {
            setUsernameError("");
        }

        if (password === "") {
            valid = false;
            setPasswordError("");
        } else if (password.length > 64) {
            valid = false;
            setPasswordError("Password is too long.");
        } else if (password.length < 3) {
            valid = false;
            setPasswordError("Password is too short.");
        } else {
            setPasswordError("");
        }

        return valid;
    };

    const rememberCredentialsChanged = async () => {
        setRememberCredentials(!rememberCredentials);
    };

    useEffect(() => {
        const initialiseCredentials = async () => {
            const cachedCredentials = await SecureStore.getItemAsync(credentialCacheKey(brokerId));
            if (cachedCredentials) {
                const { username, password } = JSON.parse(cachedCredentials);
                setUsername(username);
                setPassword(password);
                setRememberCredentials(true);
            } else {
                setRememberCredentials(false);
            }
        };

        initialiseCredentials();
    }, [brokerId]);

    useEffect(() => {
        validateForm();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, password]);

    return (
        <KeyboardAwareScrollView bottomOffset={keyboardOffset}>
            <UserNote
                style={{ paddingHorizontal: 0, paddingBottom: 10 }}
                text="Service is not storing client credentials you need to provide them each time connection will be lost and not recovered."
            />

            <Input
                title="Username"
                value={username}
                setValue={setUsername}
                error={usernameError}
                placeholder={"HomeMobileApp"}
            />

            <PasswordInput
                title="Password"
                value={password}
                setValue={setPassword}
                error={passwordError}
                placeholder="Password"
            />

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 }}>
                <Switch
                    value={{ value: rememberCredentials }}
                    onPress={rememberCredentialsChanged}
                    orientation={"horizontal"}
                    style={{ height: 26, width: 50 }}
                />

                <Text size="small" color="onBackground">
                    Remember credentials on this device
                </Text>
            </View>

            <Button
                style={{ marginTop: 20 }}
                name="Start Broker Client"
                onPress={submitClicked}
                loading={loading}
            />
        </KeyboardAwareScrollView>
    );
};

export default StartBrokerClientForm;
