import React, { useEffect, useState } from "react";
import { CalculatedWidget } from "../../dashboards/DashboardView";
import { LayoutChangeEvent, Modal, Pressable, View } from "react-native";
import Text from "@/components/common/Text";
import ColorPicker, {
    ColorFormatsObject,
    HueCircular,
    Panel1,
    Preview,
} from "reanimated-color-picker";
import { shadowStyles } from "@/styles/shadowStyles";
import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { toProtoValue } from "@/api/json";
import { useTheme } from "@/contexts/ThemeProvider";

interface ColorWidgetProps {
    operations: () => void;
    widget: CalculatedWidget;
    disabled: boolean;
}

const ColorWidget: React.FC<ColorWidgetProps> = ({ widget, operations, disabled }) => {
    const theme = useTheme();
    const toast = useToast();
    const api = useApi();

    const [showModal, setShowModal] = useState(false);

    const [height, setHeight] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);

    const [color, setColor] = useState<string>(widget.configuration?.runtime?.value ?? "#000000");
    const [tempColor, setTempColor] = useState<string>(
        widget.configuration?.runtime?.value ?? "#000000",
    );

    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const updatedColor = widget.configuration?.runtime?.value ?? "#000000";
        if (updatedColor !== color) {
            setColor(updatedColor);
            setTempColor(updatedColor);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widget.configuration?.runtime?.value]);

    const setColorValue = async (newColor: ColorFormatsObject) => {
        if (loading) {
            console.warn("[Button Widget] Action already in progress.");
            return;
        }

        if (disabled) {
            console.warn("[Color Widget] Widget is disabled.");
            return;
        }

        setLoading(true);

        const result = await callSimple(() =>
            api.widgets.action({ widgetId: widget.id, value: toProtoValue(newColor.hex) }),
        );

        if (result.isSuccess) {
            console.info("[Button Widget] Action sent successfully.");
            setColor(newColor.hex);
        } else {
            toast.apiError(result);
        }

        setLoading(false);

        if (showModal) {
            setShowModal(false);
        }
    };

    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setWidth(width);
        setHeight(height);
    };

    const onPickPress = () => {
        if (disabled) {
            console.warn("[Color Widget] Widget is disabled.");
            return;
        }

        setShowModal(true);
    };

    return (
        <Pressable
            onLongPress={operations}
            onLayout={onLayout}
            style={{
                width: "100%",
                height: "100%",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}>
            {(height < 140 || width < 140) && (
                <Pressable
                    onPress={onPickPress}
                    onLongPress={operations}
                    style={{
                        width: "100%",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: color,
                        borderRadius: 8,
                        ...shadowStyles.default,
                    }}>
                    <Text size={"medium"} color={"contrast"} contrastingColor={color}>
                        {color}
                    </Text>
                </Pressable>
            )}

            {height >= 140 && width >= 140 && disabled && (
                <View style={{ alignContent: "center", justifyContent: "center" }}>
                    <Text size={"medium"} color={"complementary"}>
                        {widget.name}
                    </Text>
                </View>
            )}

            {height >= 140 && width >= 140 && !disabled && (
                <View
                    style={{
                        width: "100%",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                    <ColorPicker
                        style={{ width: Math.min(width, height) }}
                        value={color}
                        onCompleteJS={setColorValue}>
                        <HueCircular
                            containerStyle={{
                                justifyContent: "center",
                                backgroundColor: theme.current.colors.background,
                            }}
                            thumbShape="pill">
                            <Panel1
                                style={{
                                    borderRadius: 16,
                                    width: "70%",
                                    height: "70%",
                                    alignSelf: "center",
                                }}
                            />
                        </HueCircular>
                    </ColorPicker>
                </View>
            )}

            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}>
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                    onPress={() => setShowModal(false)} // Close on backdrop tap
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()} // Prevent closing when tapping inside modal content
                        style={{
                            backgroundColor: theme.current.colors.background,
                            borderRadius: 12,
                            padding: 16,
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        <ColorPicker
                            style={{ width: 240, height: 270, gap: 10 }}
                            value={color}
                            onChangeJS={({ hex }) => setTempColor(hex)}>
                            <Preview />
                            <HueCircular
                                containerStyle={{ justifyContent: "center" }}
                                thumbShape="pill">
                                <Panel1
                                    style={{
                                        borderRadius: 16,
                                        width: "70%",
                                        height: "70%",
                                        alignSelf: "center",
                                    }}
                                />
                            </HueCircular>
                        </ColorPicker>

                        <View
                            style={{
                                flexDirection: "row",
                                marginTop: 16,
                                justifyContent: "flex-end",
                                width: 240,
                            }}>
                            <Pressable
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 20,
                                    borderRadius: 8,
                                    backgroundColor: theme.current.colors.background,
                                }}
                                onPress={() =>
                                    setColorValue({ hex: tempColor } as ColorFormatsObject)
                                }>
                                <Text color="onPrimary" size={"medium"} bold>
                                    Confirm
                                </Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </Pressable>
    );
};

export default ColorWidget;
