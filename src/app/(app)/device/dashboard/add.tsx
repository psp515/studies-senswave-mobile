import Button from "@/components/common/Button";
import DashboardForm, { DashboardFormHandle } from "@/components/device/dashboards/DashboardForm";
import { useDevice } from "@/contexts/custom/DeviceProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";

function Add() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const dashboards = useDevice();
    const { deviceId } = useLocalSearchParams();
    const formRef = useRef<DashboardFormHandle>(null);
    const [loading, setLoading] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    const addClicked = async (values: any) => {
        if (typeof deviceId !== "string") return;
        setLoading(true);

        const result = await callSimple(() =>
            api.dashboards.createDashboard({
                deviceId,
                name: values.name,
                icon: values.icon,
                configuration: {
                    rows: values.configuration.rows,
                    columns: values.configuration.columns,
                },
            }),
        );

        if (result.isSuccess) {
            toast.success("Dashboard added successfully.");
            await dashboards.refresh(true);
            router.back();
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    return (
        <View style={{ flex: 1 }}>
            <DashboardForm
                ref={formRef}
                edit={false}
                onSubmit={addClicked}
                deviceId={deviceId as string}
                onValidChange={setIsFormValid}
            />

            <KeyboardStickyView style={{ paddingHorizontal: 15, paddingVertical: 12 }}>
                <Button
                    name="Create Dashboard"
                    loading={loading}
                    onPress={() => formRef.current?.triggerSave()}
                    style={!isFormValid ? { opacity: 0.4 } : undefined}
                />
            </KeyboardStickyView>
        </View>
    );
}

export default Add;
