import React, { useEffect, useState } from "react";
import { CalculatedWidget } from "../../dashboards/DashboardView";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import { useTheme } from "@/contexts/ThemeProvider";
import { shadowStyles } from "@/styles/shadowStyles";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { toProtoValue } from "@/api/json";
import { useToast } from "@/contexts/ToastProvider";
import Text from "@/components/common/Text";
import Icon from "@/components/common/Icon";
import Loading from "@/components/common/Loading";

interface SwitchWidgetProps {
    operations: () => void;
    widget: CalculatedWidget;
    disabled: boolean;
}

const SwitchWidget: React.FC<SwitchWidgetProps> = ({ operations, widget, disabled }) => {
    const toast = useToast();
    const theme = useTheme();
    const api = useApi();
    const [loading, setLoading] = useState(false);
    const [isChecked, setIsChecked] = useState(widget?.configuration?.runtime?.value ?? false);
    const [containerHeight, setContainerHeight] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    const handleToggle = async () => {
        if (disabled) {
            console.info("[SwitchWidget] Toggle is disabled.");
            return;
        }

        if (loading) {
            console.warn("[Button Widget] Action already in progress.");
            return;
        }

        setLoading(true);

        try {
            const newValue = !isChecked;

            const result = await callSimple(() =>
                api.widgets.action({ widgetId: widget.id, value: toProtoValue(newValue) }),
            );

            if (result.isSuccess) {
                console.info("[Button Widget] Action sent successfully.");
                setIsChecked(newValue);
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error("[SwitchWidget] Error toggling switch:", error);
            toast.error("Failed to toggle switch.");
        } finally {
            setLoading(false);
        }
    };

    const onLayout = (event: LayoutChangeEvent) => {
        setContainerHeight(event.nativeEvent.layout.height);
        setContainerWidth(event.nativeEvent.layout.width);
    };

    useEffect(() => {
        setIsChecked(widget?.configuration?.runtime?.value ?? false);
    }, [widget?.configuration?.runtime?.value]);

    return (
        <Pressable
            onLayout={onLayout}
            style={[
                {
                    borderRadius: 8,
                    width: "100%",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: isChecked
                        ? theme.current.colors.success
                        : theme.current.colors.error,
                    ...shadowStyles.default,
                },
            ]}
            disabled={disabled}
            onPress={handleToggle}
            onLongPress={operations}>
            <View
                style={{
                    justifyContent: "center",
                    alignItems: "center",
                    height: containerHeight * 0.4 > 0 ? containerHeight * 0.4 : 24,
                    padding: 0,
                    margin: 0,
                }}>
                {loading ? (
                    <Loading
                        size={containerHeight * 0.4 > 0 ? containerHeight * 0.4 : 24}
                        useBackgroundColor={false}
                    />
                ) : (
                    <Icon
                        icon={"power-outline"}
                        color={"onPrimary"}
                        size={
                            Math.min(containerHeight * 0.4, containerWidth * 0.4) > 0
                                ? Math.min(containerHeight * 0.4, containerWidth * 0.4)
                                : 24
                        }
                    />
                )}
            </View>

            <Text
                size={containerHeight < 56 ? "small" : "medium"}
                color={"onPrimary"}
                style={{ textAlign: "center" }}
                numberOfLines={1}>
                {widget?.name}
            </Text>
        </Pressable>
    );
};

export default SwitchWidget;
