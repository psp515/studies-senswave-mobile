import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import WidgetForm from "@/components/device/widgets/WidgetForm";
import { useWidgetDetails, WidgetDetailsProvider } from "@/contexts/custom/WidgetDetailsProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

function InternalDetails() {
    const toast = useToast();
    const widgetDetails = useWidgetDetails();
    const { widgetId } = useLocalSearchParams<{ widgetId: string }>();

    const editClicked = async () => {
        console.warn("[WidgetDetails] Edit clicked. But is disabled for now.");
        toast.error("Edit is not supported yet.");
    };

    useEffect(() => {
        widgetDetails.initializeForDisplay(widgetId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetId]);

    if (!widgetDetails || widgetDetails.loading) {
        return <Loading />;
    }

    return (
        <View style={{ flex: 1 }}>
            <WidgetForm onSubmit={editClicked} edit={true} />
        </View>
    );
}

function Details() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const { widgetId } = useLocalSearchParams<{ widgetId: string }>();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const deleteWidget = async () => {
        if (!widgetId) return;

        const result = await callSimple(
            () => api.widgets.deleteWidget({ widgetId }),
            "Failed to remove widget.",
        );

        if (result.isSuccess) {
            toast.success("Widget removed successfully.");
            router.back();
        } else {
            toast.apiError(result);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    const fabActions: FABAction[] = [
        { icon: "trash-outline", label: "Delete Widget", onPress: deleteClicked },
    ];

    return (
        <WidgetDetailsProvider>
            <View style={{ flex: 1 }}>
                <ConfirmDialog
                    visible={showDeleteDialog}
                    title="Delete Widget"
                    content="The widget definition will be permanently deleted and it may break widget placements on dashboards. This action cannot be undone."
                    confirmLabel="Delete"
                    onConfirm={() => {
                        setShowDeleteDialog(false);
                        deleteWidget();
                    }}
                    onCancel={() => setShowDeleteDialog(false)}
                />
                <InternalDetails />
                <FAB actions={fabActions} />
            </View>
        </WidgetDetailsProvider>
    );
}

export default Details;
