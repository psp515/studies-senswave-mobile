import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import OperationForm from "@/components/device/operation/OperationForm";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { OperationDto, toOperationDto } from "@/types/DeviceTypes";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

function Details() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const { operationId } = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [operation, setOperation] = useState<OperationDto | undefined>(undefined);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const deleteOperation = async () => {
        if (typeof operationId !== "string") return;

        const result = await callSimple(() => api.operations.deleteOperation({ operationId }));

        if (result.isSuccess) {
            toast.success("Operation removed successfully.");
            router.back();
        } else {
            toast.apiError(result);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    useEffect(() => {
        const getOperation = async () => {
            if (typeof operationId !== "string") return;
            setLoading(true);

            const result = await call(
                () => api.operations.getOperation({ operationId }),
                "Failed to load operation details.",
            );

            if (result.isSuccess && result.data) {
                setOperation(toOperationDto(result.data));
            } else {
                toast.apiError(result);
            }

            setLoading(false);
        };

        getOperation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operationId]);

    if (loading) return <Loading />;

    const fabActions: FABAction[] = [
        { icon: "trash-outline", label: "Delete", onPress: deleteClicked },
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Operation"
                content="The operation and all widgets linked to it will be permanently deleted. This may break widget placements on dashboards. Automations using it will stop working. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteOperation();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <OperationForm
                edit={true}
                onSubmit={async () => {
                    console.warn("Operation can not be edited.");
                }}
                initName={operation?.name}
                initTopic={operation?.topic}
                initType={operation?.type}
                initConfiguration={operation?.configuration}
            />

            <FAB actions={fabActions} />
        </View>
    );
}

export default Details;
