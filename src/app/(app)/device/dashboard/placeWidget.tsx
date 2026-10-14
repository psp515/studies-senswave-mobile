import ImageButton from "@/components/common/ImageButton";
import WidgetList from "@/components/device/widgets/WidgetList";
import { useDevice } from "@/contexts/custom/DeviceProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

const PlaceWidget = () => {
    const router = useRouter();
    const api = useApi();
    const device = useDevice();
    const toast = useToast();
    const { row, column, rowSpan, columnSpan } = useLocalSearchParams();

    const onWidgetSelected = async (widgetId: string) => {
        console.info("[PlaceWidget] Widget selected: " + widgetId);

        const values = {
            widgetId: widgetId,
            row: Number(row),
            column: Number(column),
            rowSpan: Number(rowSpan),
            columnSpan: Number(columnSpan),
        };

        console.info("[PlaceWidget] Placing widget with values: ", values);

        const dashboardId = device.currentDashboardId;
        if (!dashboardId) {
            router.back();
            return;
        }

        const result = await callSimple(
            () => api.dashboards.setWidgetOnDashboard({ dashboardId, ...values }),
            "Failed to place widget: area is overlapping or out of bounds.",
        );

        if (result.isSuccess) {
            toast.success("Widget placed on dashboard successfully.");
            device.refresh(true);
        } else {
            toast.apiError(result);
        }

        router.back();
    };

    const addOperationClicked = async () => {
        console.info("[Widget List Page] Add Operation Clicked.");
        router.push({ pathname: "device/operation/add" });
    };

    return (
        <View style={{ flex: 1 }}>
            <WidgetList overrideOnClick={onWidgetSelected} />

            <View
                style={{
                    position: "absolute",
                    bottom: 0,
                    paddingHorizontal: 15,
                    marginBottom: 15,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    width: "100%",
                    flexDirection: "row",
                    gap: 15,
                }}>
                <ImageButton icon="add-outline" size={40} onPress={addOperationClicked} />
            </View>
        </View>
    );
};

export default PlaceWidget;
