import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import DeviceForm, { DeviceFormRef } from "@/components/device/DeviceForm";
import { Device, useDeviceList } from "@/contexts/custom/DeviceListProvider";
import { useHttpClient } from "@/contexts/HttpClientProvider";
import { useToast } from "@/contexts/ToastProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

function Details() {
    const toast = useToast();
    const router = useRouter();
    const httpClient = useHttpClient();
    const { deviceId } = useLocalSearchParams();
    const formRef = useRef<DeviceFormRef>(null);
    const [loading, setLoading] = useState(false);
    const [device, setDevice] = useState<Device | undefined>(undefined);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const devices = useDeviceList();

    const editClicked = async (values: any) => {
        const response = await httpClient.patch(`v1/devices/${deviceId}`, values);

        if (response.isSuccess) {
            toast.success("Device updated successfully.");
            setHasChanges(false);
            await devices.refresh();
        } else {
            toast.error("Failed to update device.");

            const data = await response.response?.text();
            console.error("[Dashboard Add] Error: " + data);
        }
    };

    const deleteDevice = async () => {
        setLoading(true);

        try {
            const response = await httpClient.delete(`v1/devices/${deviceId}`);
            if (response.isSuccess) {
                toast.success("Device removed successfully.");
                await devices.refresh();
                router.back();
            } else {
                toast.httpError(response);
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
            setLoading(true);

            const response = await httpClient.get("v1/devices/" + deviceId);

            if (response.isSuccess) {
                const content = (await response.response?.json()) as Device;
                setDevice(content);
            } else {
                toast.error("Failed to load device details.");
                const content = await response.response?.text();
                console.error("[Device Details] Error: " + content);
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
