import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import { DataSourceForm, DataSourceFormHandle } from "@/components/dataSource/DataSourceForm";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { DataSourceDto, toDataSourceDto } from "@/types/DataSourcesTypes";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

function DataSourceDetailsSection() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = idParam ?? "";
    const api = useApi();
    const toast = useToast();
    const router = useRouter();

    const formRef = useRef<DataSourceFormHandle>(null);
    const [loading, setLoading] = useState(false);
    const [dataSource, setDataSource] = useState<DataSourceDto | undefined>(undefined);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const editClicked = async (values: any) => {
        setLoading(true);

        const result = await callSimple(
            () =>
                api.dataSources.updateBroker({
                    brokerId: id,
                    name: values.name,
                    url: values.url,
                    clientName: values.clientName,
                    port: values.port,
                    protocolVersion: values.protocolVersion,
                    useTls: values.useTls,
                    username: values.username,
                    password: values.password,
                }),
            "Failed to update data source.",
        );

        if (result.isSuccess) {
            toast.success("Data source updated successfully.");
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    const deleteDataSource = async () => {
        setLoading(true);

        try {
            const result = await callSimple(() => api.dataSources.deleteBroker({ brokerId: id }));

            if (result.isSuccess) {
                toast.success("Data source removed successfully.");
                router.back();
            } else {
                toast.apiError(result);
            }
        } finally {
            setLoading(false);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const result = await call(() => api.dataSources.getBroker({ brokerId: id }));

            if (result.isSuccess) {
                setDataSource(toDataSourceDto(result.data!));
            } else {
                toast.apiError(result);
            }

            setLoading(false);
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <Loading />;

    const fabActions: FABAction[] = [
        ...(isFormDirty
            ? [
                  {
                      icon: "checkmark-outline",
                      label: "Save",
                      onPress: () => formRef.current?.triggerSave(),
                  },
                  {
                      icon: "refresh-outline",
                      label: "Restore",
                      onPress: () => formRef.current?.triggerReset(),
                  },
              ]
            : []),
        { icon: "trash-outline", label: "Delete Data Source", onPress: deleteClicked },
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Remove Data Source"
                content="Are you sure you want to remove this data source?"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteDataSource();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <DataSourceForm
                ref={formRef}
                edit={true}
                onClick={editClicked}
                onDirtyChange={setIsFormDirty}
                id={dataSource?.id}
                initServer={dataSource?.url}
                initName={dataSource?.name}
                initClientName={dataSource?.clientName}
                initPort={dataSource?.port}
                initMqttVersion={dataSource?.protocolVersion}
                initTls={dataSource?.useTls}
            />

            <FAB actions={fabActions} forceExpanded={isFormDirty} />
        </View>
    );
}

export default DataSourceDetailsSection;
