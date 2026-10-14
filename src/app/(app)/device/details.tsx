import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import DeviceForm, { DeviceFormRef } from "@/components/device/DeviceForm";
import { Device, useDeviceList } from "@/contexts/custom/DeviceListProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple } from "@/api/call";
import { toDeviceDetails } from "@/types/DeviceTypes";
import { useToast } from "@/contexts/ToastProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

function Details() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const { deviceId } = useLocalSearchParams();
    const formRef = useRef<DeviceFormRef>(null);
    const [loading, setLoading] = useState(false);
    const [device, setDevice] = useState<Device | undefined>(undefined);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const devices = useDeviceList();

    const editClicked = async (values: any) => {
        if (typeof deviceId !== "string") return;

        // Unchanged string fields are "" (omitted on the wire); null ids become "" (sent as null).
        const nullable = (v: string | null | undefined) =>
            v === undefined ? undefined : (v ?? "");

        const result = await callSimple(
            () =>
                api.devices.updateDevice({
                    deviceId,
                    roomId: nullable(values.roomId),
                    name: values.name ?? "",
                    icon: values.icon ?? "",
                    operationId: nullable(values.operationId),
                    displayableOperationId: nullable(values.displayableOperationId),
                    configuration: values.configuration,
                    type: values.type ?? "",
                    presenceOperationId: values.presenceOperationId ?? "",
                    presenceType: values.presenceType ?? "",
                }),
            "Failed to update device.",
        );

        if (result.isSuccess) {
            toast.success("Device updated successfully.");
            setHasChanges(false);
            await devices.refresh();
        } else {
            toast.apiError(result);
        }
    };

    const deleteDevice = async () => {
        if (typeof deviceId !== "string") return;
        setLoading(true);

        try {
            const response = await callSimple(() => api.devices.deleteDevice({ deviceId }));
            if (response.isSuccess) {
                toast.success("Device removed successfully.");
                await devices.refresh();
                router.back();
            } else {
                toast.apiError(response);
            }
        } finally {
            setLoading(false);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    const widgetClicked = () => {
        router.push({ pathname: "device/widget/list" });
    };

    const fabActions: FABAction[] = [
        ...(hasChanges
            ? [
                  {
                      icon: "checkmark-outline",
                      label: "Save",
                      onPress: () => formRef.current?.save(),
                  },
                  {
                      icon: "refresh-outline",
                      label: "Reset",
                      onPress: () => formRef.current?.reset(),
                  },
              ]
            : []),
        { icon: "construct-outline", label: "Operations & Widgets", onPress: widgetClicked },
        { icon: "trash-outline", label: "Delete", onPress: deleteClicked },
    ];

    useEffect(() => {
        const getDevice = async () => {
            if (typeof deviceId !== "string") return;
            setLoading(true);

            const result = await call(
                () => api.devices.getDevice({ deviceId }),
                "Failed to load device details.",
            );

            if (result.isSuccess && result.data) {
                setDevice(toDeviceDetails(result.data));
            } else {
                toast.apiError(result);
            }

            setLoading(false);
        };

        getDevice();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <Loading />;

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Device"
                content="The device and all its dashboards, widgets, and operations will be permanently deleted. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteDevice();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <DeviceForm
                ref={formRef}
                deviceId={deviceId as string}
                edit={true}
                onSubmit={editClicked}
                onHasChanges={setHasChanges}
                initName={device?.name}
                initIcon={device?.icon}
                initRoomId={device?.roomId ?? undefined}
                initTileType={device?.tile.type}
                initTileOperationId={device?.tile.operationId}
                initTileDisplayableOperationId={device?.tile.displayableOperationId}
                initTileUnit={device?.tile.configuration?.unit as string | undefined}
                initPresenceType={device?.presence?.type}
                initPresenceOperationId={device?.presence?.operationId}
            />
            <FAB actions={fabActions} forceExpanded={hasChanges} />
        </View>
    );
}

export default Details;
