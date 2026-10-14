import React, { useEffect, useState } from "react";
import { CalculatedWidget, PositionedWidget } from "../../dashboards/DashboardView";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import { useTheme } from "@/contexts/ThemeProvider";
import { shadowStyles } from "@/styles/shadowStyles";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { toProtoValue } from "@/api/json";
import { useToast } from "@/contexts/ToastProvider";
import Text from "@/components/common/Text";
import Icon from "@/components/common/Icon";
import { ScrollView } from "react-native-gesture-handler";
import Loading from "@/components/common/Loading";
import { RadioOption } from "../forms/Radio/RadioForm";
import { useDevice } from "@/contexts/custom/DeviceProvider";

interface RadioWidgetProps {
    operations: () => void;
    widget: CalculatedWidget;
    positionedWidget: PositionedWidget;
    disabled: boolean;
}

const RadioDisplayOption: React.FC<{
    option: RadioOption;
    isSelected: boolean;
    onPress: (optionName: RadioOption) => void;
    onLongPress: () => void;
    itemWidth: number;
    itemHeight: number;
}> = ({ option, isSelected, onPress, onLongPress, itemWidth, itemHeight }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);

    const handlePress = () => {
        setLoading(true);
        onPress(option);
        setLoading(false);
    };

    return (
        <View
            style={{
                width: itemWidth,
                height: itemHeight,
                padding: 8,
            }}>
            <Pressable
                onPress={handlePress}
                onLongPress={onLongPress}
                style={[
                    {
                        flex: 1,
                        borderRadius: 8,
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected
                            ? theme.current.colors.primary
                            : theme.current.colors.background,
                        // Always apply shadow to maintain rendering consistency
                        ...shadowStyles.default,
                    },
                    isSelected ? {} : { shadowOpacity: 0, elevation: 0 },
                ]}>
                {loading ? (
                    <Loading size={itemHeight / 3} />
                ) : (
                    <View style={{ alignItems: "center", justifyContent: "center" }}>
                        <Icon icon={option.icon} size={itemHeight / 3} color={"onPrimary"} />
                        <Text size={"small"} color={"onPrimary"} numberOfLines={1}>
                            {option.displayName}
                        </Text>
                    </View>
                )}
            </Pressable>
        </View>
    );
};

const RadioWidget: React.FC<RadioWidgetProps> = ({
    operations,
    positionedWidget,
    widget,
    disabled,
}) => {
    const toast = useToast();
    const device = useDevice();
    const api = useApi();

    const [loading, setLoading] = useState(false);

    const radioOptions = (widget?.configuration?.options as RadioOption[]) ?? [];
    const currentRadioOption = radioOptions.find(
        (option) => option.optionName === widget.configuration.runtime?.value,
    );

    const [selectedOption, setSelectedOption] = useState<RadioOption | undefined>(
        currentRadioOption,
    );

    const [containerHeight, setContainerHeight] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    const columns = positionedWidget.columnSpan;
    const rows = positionedWidget.rowSpan;

    useEffect(() => {
        if (device.currentDashboard) {
            const newWidget = (
                device.currentDashboard.configuration.calculatedWidgets as {
                    id: any;
                    configuration?: any;
                }[]
            ).find((w) => w?.id === widget?.id);

            if (!newWidget) {
                console.warn("[RadioWidget] Widget not found in current dashboard.");
                return;
            }

            const currentValue = newWidget.configuration.runtime?.value;

            setSelectedOption(radioOptions.find((option) => option.optionName === currentValue));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device.currentDashboard]);

    const handleToggle = async (selectedOption: RadioOption) => {
        if (disabled) {
            console.info("[RadioWidget] Change is disabled.");
            return;
        }

        if (loading) {
            console.warn("[RadioWidget] Action already in progress.");
            return;
        }

        setLoading(true);

        try {
            const result = await callSimple(() =>
                api.widgets.action({
                    widgetId: widget.id,
                    value: toProtoValue(selectedOption.optionName),
                }),
            );

            if (result.isSuccess) {
                console.info("[RadioWidget] Action sent successfully.");
                setSelectedOption(selectedOption);
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error("[RadioWidget] Error changing option:", error);
            toast.error("Failed to change option.");
        } finally {
            setLoading(false);
        }
    };

    const onLayout = (event: LayoutChangeEvent) => {
        setContainerHeight(event.nativeEvent.layout.height);
        setContainerWidth(event.nativeEvent.layout.width);
    };

    const itemWidth = containerWidth / columns;
    const itemHeight = containerHeight / rows;

    const [contentWidth, setContentWidth] = useState(0);
    const [scrollX, setScrollX] = useState(0);

    const showRightIndicator =
        contentWidth > containerWidth && scrollX < contentWidth - containerWidth;
    const showLeftIndicator = scrollX > 0;

    const onContentSizeChange = (w: number) => {
        setContentWidth(w);
    };

    return (
        <View
            onLayout={onLayout}
            style={[
                {
                    borderRadius: 8,
                    width: "100%",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                },
            ]}>
            {containerHeight <= 0 || containerWidth <= 0 ? (
                <Loading />
            ) : (
                <ScrollView
                    onContentSizeChange={(w) => onContentSizeChange(w)}
                    onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
                    scrollEventThrottle={16}
                    horizontal={columns >= rows}
                    contentContainerStyle={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}>
                    {radioOptions.map((option) => (
                        <RadioDisplayOption
                            key={option.optionName}
                            option={option}
                            isSelected={selectedOption?.optionName === option.optionName}
                            onPress={handleToggle}
                            onLongPress={operations}
                            itemWidth={itemWidth}
                            itemHeight={itemHeight}
                        />
                    ))}
                </ScrollView>
            )}

            {showRightIndicator && (
                <View
                    style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 24,
                        justifyContent: "center",
                        alignItems: "center",
                        borderTopRightRadius: 8,
                        borderBottomRightRadius: 8,
                    }}>
                    <Icon icon="chevron-forward" size={24} color="complementary" />
                </View>
            )}

            {showLeftIndicator && (
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 24,
                        justifyContent: "center",
                        alignItems: "center",
                        borderTopLeftRadius: 8,
                        borderBottomLeftRadius: 8,
                    }}>
                    <Icon icon="chevron-back" size={24} color="complementary" />
                </View>
            )}
        </View>
    );
};

export default RadioWidget;
