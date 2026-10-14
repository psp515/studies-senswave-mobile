import DeviceForm from "@/components/device/DeviceForm";
import { useDeviceList } from "@/contexts/custom/DeviceListProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

function Add() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const devices = useDeviceList();
    const addClicked = async (values: any) => {
        const result = await callSimple(
            () =>
                api.devices.createDevice({
                    homeId: values.homeId,
                    roomId: values.roomId ?? "",
                    name: values.name,
                    icon: values.icon,
                }),
            "Failed to add device.",
        );

        if (result.isSuccess) {
            toast.success("Device added successfully.");
            await devices.refresh();
            router.back();
        } else {
            toast.apiError(result);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <DeviceForm edit={false} onSubmit={addClicked} />
        </View>
    );
}

export default Add;
