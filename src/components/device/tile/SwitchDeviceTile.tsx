import { View, StyleSheet } from "react-native";
import React, { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastProvider";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple, isNotFound } from "@/api/call";
import { toProtoValue } from "@/api/json";
import { toDevice } from "@/types/DeviceTypes";
import { useLiveUpdate } from "@/contexts/domain/LiveUpdateProvider";
import { useDeviceList } from "@/contexts/custom/DeviceListProvider";
import Icon from "@/components/common/Icon";
import { Switch } from "@/components/common/Switch";

interface SwitchDeviceTileProps {
    deviceId: string;
    icon: string;
    tile: any;
    disablePress: boolean;
}

function SwitchDeviceTile({ deviceId, icon, tile, disablePress }: SwitchDeviceTileProps) {
    const toast = useToast();
    const homes = useHomes();
    const devices = useDeviceList();
    const api = useApi();
    const liveUpdate = useLiveUpdate();
    const [processing, setProcessing] = useState(false);

    const [isOn, setIsOn] = useState(tile.value === true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const updateCallback = async (message: string) => {
        try {
            const result = await call(() => api.devices.displayDevice({ deviceId }));

            if (result.isSuccess) {
                const response = toDevice(result.data!.device!);

                const value = response.tile.value === true;
                setIsOn(value);
                console.debug("[Switch Device Tile] Device tile updated.");
                devices.updateDeviceOperation(response);
            } else if (isNotFound(result)) {
                toast.error("Failed to update device tile. Please refresh.");
            }
        } catch (error) {
            console.error("[Switch Device Tile] Failed to update device tile.", error);
            toast.error("Failed to update device tile.");
        }
    };

    useEffect(() => {
        liveUpdate.addDeviceTileCallback(deviceId, updateCallback);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homes.current]);

    const switchClicked = async () => {
        if (disablePress) {
            toast.info("Device tile update is disabled.");
            return;
        }

        if (processing) {
            console.debug("[Switch Device Tile] Already processing");
            return;
        }

        try {
            setProcessing(true);

            const result = await callSimple(() =>
                api.devices.deviceTileAction({ deviceId, value: toProtoValue(!isOn) }),
            );

            if (result.isSuccess) {
                console.debug(
                    "[Switch Device Tile] Device state updated on server. Event should arrive to refresh device status.",
                );
            } else {
                toast.apiError(result);
            }
        } catch {
            console.error("[Switch Device Tile] Failed to update device state.");
            toast.error("Unexpected error occurred while updating device state.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <View style={styles.actionContainer}>
            <View style={styles.iconContainer}>
                <Icon icon={icon} size={64} color={"onPrimary"} />
            </View>
            <View style={styles.switchContainer}>
                <Switch
                    value={{ value: isOn }}
                    onPress={switchClicked}
                    style={styles.switch}
                    orientation="vertical"
                />
            </View>
        </View>
    );
}

export default SwitchDeviceTile;

const styles = StyleSheet.create({
    actionContainer: {
        width: "100%",
        height: "60%",
        flexDirection: "row",
    },
    iconContainer: {
        justifyContent: "center",
        alignItems: "center",
        width: "60%",
        height: "100%",
    },
    switchContainer: {
        justifyContent: "center",
        alignItems: "center",
        width: "40%",
        height: "100%",
    },
    switch: {
        width: 64,
        height: 34,
    },
});
