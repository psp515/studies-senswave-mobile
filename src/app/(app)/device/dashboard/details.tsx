import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import DashboardForm, { DashboardFormHandle } from "@/components/device/dashboards/DashboardForm";
import { DashboardDto } from "@/components/device/dashboards/DashboardView";
import { useDevice } from "@/contexts/custom/DeviceProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple } from "@/api/call";
import { structToJson } from "@/api/json";
import { useToast } from "@/contexts/ToastProvider";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

function Details() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const dashboards = useDevice();
    const [loading, setLoading] = useState(false);
    const [dashboard, setDashboard] = useState<DashboardDto | undefined>(undefined);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const formRef = useRef<DashboardFormHandle>(null);
    const editClicked = async (values: any) => {
        const dashboardId = dashboards.currentDashboardId;
        if (!dashboardId) return;

        const result = await callSimple(
            () =>
                api.dashboards.updateDashboard({
                    dashboardId,
                    name: values.name ?? "",
                    icon: values.icon ?? "",
                }),
            "Failed to update dashboard.",
        );

        if (result.isSuccess) {
            toast.success("Dashboard updated successfully.");
            await dashboards.refresh(true);
        } else {
            toast.apiError(result);
        }
    };

    const deleteDashboard = async () => {
        const dashboardId = dashboards.currentDashboardId;
        if (!dashboardId) return;

        const result = await callSimple(
            () => api.dashboards.deleteDashboard({ dashboardId }),
            "Failed to remove dashboard.",
        );

        if (result.isSuccess) {
            toast.success("Dashboard removed successfully.");
            await dashboards.refresh(true);
            router.back();
        } else {
            toast.apiError(result);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    useEffect(() => {
        const getDashboard = async () => {
            const dashboardId = dashboards.currentDashboardId;
            if (!dashboardId) return;
            setLoading(true);

            const result = await call(
                () => api.dashboards.getDashboard({ dashboardId }),
                "Failed to load dashboard details.",
            );

            if (result.isSuccess && result.data) {
                const d = result.data;
                setDashboard({
                    id: d.id,
                    name: d.name,
                    icon: d.icon,
                    type: d.type as DashboardDto["type"],
                    configuration: structToJson(d.configuration),
                });
            } else {
                toast.apiError(result);
            }

            setLoading(false);
        };

        getDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dashboards.currentDashboardId]);

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
        { icon: "trash-outline", label: "Delete Dashboard", onPress: deleteClicked },
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Dashboard"
                content="The dashboard layout will be permanently deleted. Widgets themselves are not removed. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteDashboard();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <DashboardForm
                ref={formRef}
                deviceId=""
                onSubmit={editClicked}
                edit={true}
                onDirtyChange={setIsFormDirty}
                initName={dashboard?.name}
                initIcon={dashboard?.icon}
                initConfiguration={dashboard?.configuration}
            />

            <FAB actions={fabActions} forceExpanded={isFormDirty} />
        </View>
    );
}

export default Details;
