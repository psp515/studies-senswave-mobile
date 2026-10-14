import Button from "@/components/common/Button";
import { DataSourceForm, DataSourceFormHandle } from "@/components/dataSource/DataSourceForm";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";

function AddPage() {
    const api = useApi();
    const toast = useToast();
    const router = useRouter();
    const formRef = useRef<DataSourceFormHandle>(null);
    const [loading, setLoading] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    const addClicked = async (values: any) => {
        setLoading(true);

        const result = await callSimple(
            () =>
                api.dataSources.createBroker({
                    name: values.name,
                    url: values.url,
                    clientName: values.clientName,
                    port: values.port,
                    protocolVersion: values.protocolVersion,
                    useTls: values.useTls,
                    username: values.username,
                    password: values.password,
                }),
            "Failed to add data source.",
        );

        if (result.isSuccess) {
            toast.success("Data source added successfully.");
            router.back();
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    return (
        <View style={{ flex: 1 }}>
            <DataSourceForm
                ref={formRef}
                edit={false}
                onClick={addClicked}
                onValidChange={setIsFormValid}
            />

            <KeyboardStickyView style={{ paddingHorizontal: 15, paddingVertical: 12 }}>
                <Button
                    name="Create Data Source"
                    loading={loading}
                    onPress={() => formRef.current?.triggerSave()}
                    style={!isFormValid ? { opacity: 0.4 } : undefined}
                />
            </KeyboardStickyView>
        </View>
    );
}

export default AddPage;
