import Button from "@/components/common/Button";
import Loading from "@/components/common/Loading";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import WidgetForm, { WidgetFormHandle } from "@/components/device/widgets/WidgetForm";
import { useWidgetDetails, WidgetDetailsProvider } from "@/contexts/custom/WidgetDetailsProvider";

function InternalAdd() {
    const widgetDetails = useWidgetDetails();
    const api = useApi();
    const toast = useToast();
    const router = useRouter();
    const { operationId } = useLocalSearchParams<{ operationId: string }>();
    const formRef = useRef<WidgetFormHandle>(null);
    const [loading, setLoading] = useState(false);

    const addClicked = async (values: any) => {
        setLoading(true);

        const result = await callSimple(() =>
            api.widgets.createWidget({
                operationId: values.operationId,
                name: values.name,
                type: values.type,
                configuration: values.configuration,
            }),
        );

        if (result.isSuccess) {
            toast.success("Widget added successfully.");
            router.back();
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    useEffect(() => {
        widgetDetails.initializeForAdd(operationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!widgetDetails || widgetDetails.loading) {
        return <Loading />;
    }

    return (
        <View style={{ flex: 1 }}>
            <WidgetForm ref={formRef} onSubmit={addClicked} edit={false} hideButton={true} />

            <KeyboardStickyView style={{ paddingHorizontal: 15, paddingVertical: 12 }}>
                <Button
                    name="Add Widget"
                    loading={loading}
                    onPress={() => formRef.current?.triggerSave()}
                    style={!widgetDetails.isValid ? { opacity: 0.4 } : undefined}
                />
            </KeyboardStickyView>
        </View>
    );
}

export default function Add() {
    return (
        <WidgetDetailsProvider>
            <InternalAdd />
        </WidgetDetailsProvider>
    );
}
