import React, { FC, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import Button from "../common/Button";
import HomeCodeInput from "./HomeCodeInput";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useRouter } from "expo-router";
import { useToast } from "@/contexts/ToastProvider";
import { useHomes } from "@/contexts/domain/HomeProvider";

const CODE_LENGTH = 8;

const JoinHomeForm: FC = () => {
    const api = useApi();
    const router = useRouter();
    const toast = useToast();
    const homes = useHomes();
    const [loading, setLoading] = useState<boolean>(false);
    const [code, setCode] = useState<string>("");

    const [hasError, setHasError] = useState<boolean>(false);

    const submitClicked = async () => {
        if (code.length !== CODE_LENGTH) {
            toast.info("Enter all 8 characters before joining.");
            setHasError(true);
            return;
        }

        try {
            setLoading(true);
            console.log(code);
            const result = await callSimple(() =>
                api.homeSharing.acceptSharing({ password: code }),
            );

            if (result.isSuccess) {
                toast.success("Joined home successfully.");

                if (!homes.current) {
                    await homes.initializeCurrentHome();
                }

                router.back();
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error(`Failed to join home: ${error}.`);
            toast.error("Failed to join home.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <KeyboardAwareScrollView
                contentContainerStyle={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 15,
                }}>
                <HomeCodeInput
                    value={code}
                    onChange={(v) => {
                        setHasError(false);
                        setCode(v);
                    }}
                    error={hasError}
                />
            </KeyboardAwareScrollView>

            <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
                <View style={{ padding: 15 }}>
                    <Button
                        name="Join"
                        onPress={submitClicked}
                        type="alternative"
                        loading={loading}
                    />
                </View>
            </KeyboardStickyView>
        </View>
    );
};

export default JoinHomeForm;
