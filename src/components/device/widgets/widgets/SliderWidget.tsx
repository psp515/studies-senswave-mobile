import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
import Slider from "@/components/common/Slider";
import { CalculatedWidget } from "../../dashboards/DashboardView";
import Text from "@/components/common/Text";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { toProtoValue } from "@/api/json";
import { useToast } from "@/contexts/ToastProvider";

interface SliderWidgetProps {
    operations: () => void;
    widget: CalculatedWidget;
    disabled: boolean;
}

const SliderWidget: React.FC<SliderWidgetProps> = ({ operations, widget, disabled = false }) => {
    const { min = 0, max = 100 } = widget?.configuration?.range || {};
    const { step = 1 } = widget?.configuration || {};
    const [initialValue, setInitialValue] = React.useState(
        widget?.configuration?.runtime?.value || min,
    );

    const [loading, setLoading] = React.useState(false);
    const api = useApi();
    const toast = useToast();

    const handleValueChange = async (val: number) => {
        if (disabled) {
            return;
        }

        if (loading) {
            console.warn("[Button Widget] Action already in progress.");
            return;
        }

        setLoading(true);

        const result = await callSimple(() =>
            api.widgets.action({ widgetId: widget.id, value: toProtoValue(val) }),
        );

        if (result.isSuccess) {
            console.info("[Button Widget] Action sent successfully.");
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    useEffect(() => {
        setInitialValue(widget?.configuration?.runtime?.value || min);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widget?.configuration?.runtime?.value]);

    return (
        <Pressable
            onLongPress={operations}
            style={{
                width: "100%",
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                paddingHorizontal: 3,
            }}>
            <View style={{ paddingVertical: 6, width: "100%", alignContent: "flex-start" }}>
                <Text size={"medium"} color={"onPrimary"}>
                    {widget.name}
                </Text>
            </View>

            <View style={{ flex: 1, width: "100%", maxHeight: 50, paddingBottom: 6 }}>
                <Slider
                    min={min}
                    max={max}
                    step={step}
                    initialValue={initialValue}
                    onValueSlided={handleValueChange}
                    disabled={disabled}
                />
            </View>
        </Pressable>
    );
};

export default SliderWidget;
