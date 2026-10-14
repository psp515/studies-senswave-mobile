import { View, StyleSheet } from "react-native";
import React, { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastProvider";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import { toDevice } from "@/types/DeviceTypes";
import { useLiveUpdate } from "@/contexts/domain/LiveUpdateProvider";
import { useDeviceList } from "@/contexts/custom/DeviceListProvider";
import Icon from "@/components/common/Icon";
import Text from "@/components/common/Text";

interface DisplayDeviceTileProps {
    deviceId: string;
    icon: string;
    tile: any;
}

function DisplayDeviceTile({ deviceId, icon, tile }: DisplayDeviceTileProps) {
    const toast = useToast();
    const homes = useHomes();
    const devices = useDeviceList();
    const api = useApi();
    const liveUpdate = useLiveUpdate();

    const unit: string = tile.configuration?.unit ?? "";
    const [displayValue, setDisplayValue] = useState<string>(
        tile.value !== null && tile.value !== undefined ? String(tile.value) : "—",
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const updateCallback = async (message: string) => {
        try {
            const result = await call(() => api.devices.displayDevice({ deviceId }));

            if (result.isSuccess) {
                const response = toDevice(result.data!.device!);
                const val = response.tile.value;
                setDisplayValue(val !== null && val !== undefined ? String(val) : "—");
                console.debug("[Display Device Tile] Device tile updated.");
                devices.updateDeviceOperation(response);
            } else if (isNotFound(result)) {
                toast.error("Failed to update device tile. Please refresh.");
            }
        } catch (error) {
            console.error("[Display Device Tile] Failed to update device tile.", error);
            toast.error("Failed to update device tile.");
        }
    };

    useEffect(() => {
        liveUpdate.addDeviceTileCallback(deviceId, updateCallback);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homes.current]);

    return (
        <View style={styles.actionContainer}>
            <View style={styles.iconContainer}>
                <Icon icon={icon} size={64} color={"onPrimary"} />
            </View>
            <View style={styles.valueContainer}>
                <Text size={"large"} color={"onPrimary"} numberOfLines={1} bold>
                    {displayValue}
                </Text>
                {unit ? (
                    <Text size={"small"} color={"onPrimary"} numberOfLines={1}>
                        {unit}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

export default DisplayDeviceTile;

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
    valueContainer: {
        justifyContent: "center",
        alignItems: "center",
        width: "40%",
        height: "100%",
    },
});
