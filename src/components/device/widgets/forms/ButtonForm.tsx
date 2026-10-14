import React, { useEffect, useRef, useState } from "react";
import Input from "@/components/common/Input";
import InputNumber from "@/components/common/InputNumber";
import Text from "@/components/common/Text";
import SwitchDropdown from "@/components/common/SwitchDropdown";
import { useWidgetDetails } from "@/contexts/custom/WidgetDetailsProvider";
import { View } from "react-native";
import { OperationType } from "@/types/DeviceTypes";
import Dropdown from "@/components/common/Dropdown";
import ColorPicker, {
    BlueSlider,
    ColorFormatsObject,
    GreenSlider,
    PreviewText,
    RedSlider,
} from "reanimated-color-picker";
import { colorPickerStyle } from "@/styles/colorPickerStyle";
import { shadowStyles } from "@/styles/shadowStyles";

export const ButtonOperationTypes: OperationType[] = [
    "Text",
    "Number",
    "Integer",
    "Boolean",
    "Options",
    "HexColor",
];

interface ButtonFormProps {
    edit?: boolean;
}

const ButtonForm = ({ edit }: ButtonFormProps) => {
    const widgetDetails = useWidgetDetails();

    const operationType = widgetDetails.operation?.type || "Invalid";
    const configValue = widgetDetails.widget?.configuration?.value;

    const [booleanValue, setBooleanValue] = useState<boolean>(
        operationType === "Boolean" ? configValue : false,
    );

    const [numberValue, setNumberValue] = useState<number | undefined>(
        (operationType === "Number" || operationType === "Integer") && !isNaN(configValue)
            ? configValue
            : 0,
    );
    const numberValidRef = useRef<boolean>(numberValue !== undefined);

    const [value, setValue] = useState<string>(
        operationType === "Text" || operationType === "HexColor" ? String(configValue ?? "") : "",
    );

    const [valueError, setValueError] = useState<string>("");

    const validate = (): boolean => {
        let valid = true;

        console.info("[ButtonForm] Validating button widget.");

        if (widgetDetails.operation?.type === "Boolean") return true;

        if (
            widgetDetails.operation?.type === "Number" ||
            widgetDetails.operation?.type === "Integer"
        ) {
            if (!numberValidRef.current) {
                valid = false;
            }
            return valid;
        }

        if (widgetDetails.operation?.type === "Text") {
            if (value === "") {
                setValueError("");
                valid = false;
            } else if (value.length < 1 || value.length > 64) {
                setValueError("Text must be between 1 and 64 characters.");
                valid = false;
            } else {
                setValueError("");
            }

            return valid;
        }

        if (widgetDetails.operation?.type === "Options") {
            const options = widgetDetails.operation?.configuration.options || [];
            const selectedValue = widgetDetails.widget?.configuration.value;

            if (!options.some((x: { name: string }) => x.name === selectedValue)) {
                setValueError("Selected option is invalid.");
                valid = false;
            } else {
                setValueError("");
            }

            return valid;
        }

        if (widgetDetails.operation?.type === "HexColor") {
            const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

            if (!hexColorRegex.test(configValue)) {
                setValueError("Invalid hex color format.");
                valid = false;
            } else {
                setValueError("");
            }

            return valid;
        }

        return false;
    };

    const options =
        widgetDetails.operation?.configuration?.options?.map(
            (option: { name: string; value: string }) => ({
                name: option.name,
                value: option.name,
            }),
        ) || [];

    const [selectedValue, setSelectedValue] = useState<string>(
        widgetDetails.widget?.configuration.value || options[0]?.name || "",
    );

    useEffect(() => {
        widgetDetails.setAdditionalValidation(validate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetDetails.widget?.configuration.value]);

    useEffect(() => {
        widgetDetails.validateDto();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetDetails.widget?.configuration.value]);

    useEffect(() => {
        widgetDetails.setWidget({
            ...widgetDetails.widget!,
            configuration: {
                ...widgetDetails.widget?.configuration,
                value: selectedValue,
            },
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedValue]);

    // Initialize
    useEffect(() => {
        if (widgetDetails.operation?.type === "Boolean" && !edit) {
            console.log("here");

            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value: configValue ? configValue : false,
                },
            });
        } else if (
            (widgetDetails.operation?.type === "Number" ||
                widgetDetails.operation?.type === "Integer") &&
            !edit
        ) {
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value: !isNaN(configValue) ? configValue : 0,
                },
            });
        } else if (widgetDetails.operation?.type === "Options") {
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value: widgetDetails.widget?.configuration.value || options[0]?.name || "",
                },
            });
        } else if (widgetDetails.operation?.type === "Text") {
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value: String(configValue ?? ""),
                },
            });
        } else if (widgetDetails.operation?.type === "HexColor") {
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value: String(configValue ?? "#000000"),
                },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [hexColor, setHexColor] = useState<string>(configValue || "#000000");

    if (widgetDetails.operation?.type === "HexColor") {
        const onColorPick = (color: ColorFormatsObject) => {
            console.info("[ButtonForm] Color picked:", color.hex);
            setHexColor(color.hex);
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value: hexColor,
                },
            });
        };

        const getContrastTextColor = (hex: string) => {
            if (!/^#([A-Fa-f0-9]{6})$/.test(hex)) return "onPrimary";

            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;

            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            return luminance > 0.5 ? "onPrimary" : "onSecondary";
        };

        return (
            <View>
                <Text style={{ paddingBottom: 10 }} size="medium" color="onBackground" bold={true}>
                    {!edit ? "Select Color" : "Selected Color"}
                </Text>

                {!edit && (
                    <View style={[]}>
                        <ColorPicker
                            value={hexColor}
                            onCompleteJS={onColorPick}
                            sliderThickness={30}
                            thumbSize={30}
                            thumbShape="circle"
                            thumbAnimationDuration={100}
                            style={colorPickerStyle.picker}
                            adaptSpectrum
                            boundedThumb>
                            <View
                                style={{
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                }}>
                                <View style={{ marginTop: 5 }}>
                                    <Text
                                        style={colorPickerStyle.sliderTitle}
                                        size={"medium"}
                                        color={"onPrimary"}
                                        bold>
                                        Red
                                    </Text>
                                    <RedSlider style={colorPickerStyle.sliderStyle} />
                                </View>

                                <View style={{ marginTop: 5 }}>
                                    <Text
                                        style={colorPickerStyle.sliderTitle}
                                        size={"medium"}
                                        color={"onPrimary"}
                                        bold>
                                        Green
                                    </Text>
                                    <GreenSlider style={colorPickerStyle.sliderStyle} />
                                </View>

                                <View style={{ marginTop: 5 }}>
                                    <Text
                                        style={colorPickerStyle.sliderTitle}
                                        size={"medium"}
                                        color={"onPrimary"}
                                        bold>
                                        Blue
                                    </Text>
                                    <BlueSlider style={colorPickerStyle.sliderStyle} />
                                </View>
                            </View>
                            <PreviewText colorFormat="rgb" />
                        </ColorPicker>
                    </View>
                )}

                {edit && (
                    <View
                        style={[
                            {
                                height: 50,
                                backgroundColor: hexColor,
                                borderRadius: 10,
                                flex: 1,
                                justifyContent: "center",
                                alignItems: "center",
                            },
                            shadowStyles.default,
                        ]}>
                        <Text
                            style={colorPickerStyle.sliderTitle}
                            size={"medium"}
                            color={getContrastTextColor(hexColor)}
                            bold>
                            {hexColor}
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    if (widgetDetails.operation?.type === "Options") {
        return (
            <Dropdown
                title="Select Option"
                selectedValue={selectedValue}
                onSelected={setSelectedValue}
                options={options}
                disablePress={edit}
            />
        );
    }

    const onTextValueChange = (value: string) => {
        widgetDetails.setWidget({
            ...widgetDetails.widget!,
            configuration: {
                ...widgetDetails.widget?.configuration,
                value: value,
            },
        });
        setValue(value);
    };

    if (widgetDetails.operation!.type === "Text") {
        return (
            <Input
                error={valueError}
                value={value}
                title="Value to send"
                placeholder="value"
                setValue={onTextValueChange}
                editable={!edit}
            />
        );
    }

    if (widgetDetails.operation!.type === "Boolean") {
        return (
            <SwitchDropdown
                title="Value to send"
                value={booleanValue}
                onSelected={(v) => {
                    setBooleanValue(v);
                    widgetDetails.setWidget({
                        ...widgetDetails.widget!,
                        configuration: {
                            ...widgetDetails.widget?.configuration,
                            value: v,
                        },
                    });
                }}
                disablePress={edit}
            />
        );
    }

    const onNumberValueChange = (value: number | undefined) => {
        numberValidRef.current = value !== undefined;
        setNumberValue(value);
        if (value !== undefined) {
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    value,
                },
            });
        }
    };

    return (
        <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <InputNumber
                value={numberValue}
                title="Value to send"
                placeholder="value"
                onChange={onNumberValueChange}
                integer={widgetDetails.operation?.type === "Integer"}
                min={widgetDetails.operation?.configuration?.min}
                max={widgetDetails.operation?.configuration?.max}
                required
                editable={!edit}
            />
        </View>
    );
};

export default ButtonForm;
