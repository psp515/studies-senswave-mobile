import Button from "@/components/common/Button";
import HomeForm, { HomeFormHandle } from "@/components/home/HomeForm";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import React, { useRef, useState } from "react";
import { View } from "react-native";

function Add() {
    const router = useRouter();
    const api = useApi();
    const toast = useToast();
    const homes = useHomes();
    const { firstHome } = useLocalSearchParams();
    const formRef = useRef<HomeFormHandle>(null);
    const [loading, setLoading] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    const addClicked = async (values: any) => {
        setLoading(true);

        const result = await callSimple(() =>
            api.homes.createHome({
                name: values.name,
                icon: values.icon,
                latitude: values.latitude,
                longitude: values.longitude,
            }),
        );

        if (result.isSuccess) {
            toast.success("Home added successfully.");

            if ((firstHome as string) === "first") {
                console.info("[AddHome] First home created, reinitializing current home.");
                await homes.initializeCurrentHome();
            }

            router.back();
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    return (
        <View style={{ flex: 1 }}>
            <HomeForm
                ref={formRef}
                edit={false}
                onSubmit={addClicked}
                initIsOwner={true}
                onValidChange={setIsFormValid}
            />

            <KeyboardStickyView style={{ paddingHorizontal: 15, paddingVertical: 12 }}>
                <Button
                    name="Create Home"
                    loading={loading}
                    onPress={() => formRef.current?.triggerSave()}
                    style={!isFormValid ? { opacity: 0.4 } : undefined}
                />
            </KeyboardStickyView>
        </View>
    );
}

export default Add;
