import React, { useEffect, useImperativeHandle, useState } from "react";
import { View, StyleSheet } from "react-native";
import ImageButton from "@/components/common/ImageButton";
import Input from "@/components/common/Input";
import { WidgetType } from "@/types/DeviceTypes";
import WidgetListTile from "./WidgetListTile";
import Dropdown, { Option } from "@/components/common/Dropdown";
import OperationTile from "../operation/OperationTile";
import { useWidgetDetails } from "@/contexts/custom/WidgetDetailsProvider";
import Text from "@/components/common/Text";
import { OperationType } from "@/types/DeviceTypes";
import ButtonForm, { ButtonOperationTypes } from "@/components/device/widgets/forms/ButtonForm";
import DisplayForm, { DisplayOperationTypes } from "@/components/device/widgets/forms/DisplayForms";
import { SwitchOperationTypes } from "./forms/SwitchForm";
import SliderForm, { SliderOperationTypes } from "./forms/SliderForm";
import RadioForm from "./forms/Radio/RadioForm";
import Divider from "@/components/common/Divider";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { keyboardOffset } from "@/styles/defaultStyles";

export type WidgetFormHandle = {
    triggerSave: () => void;
};

interface WidgetFormProps {
    initName?: string;
    initType?: WidgetType;
    initEnabled?: boolean;
    initConfiguration?: any;

    onSubmit: (values: any) => Promise<void>;
    edit?: boolean;
    hideButton?: boolean;
}

const WidgetForm = React.forwardRef<WidgetFormHandle, WidgetFormProps>(function WidgetForm(
    { onSubmit, edit = false, hideButton = false },
    ref,
) {
    const widgetDetails = useWidgetDetails();
    const [loading, setLoading] = useState(false);

    const operationType = widgetDetails.operation?.type || "Invalid";

    const getWidgetTypes = () => {
        const widgets: Option[] = [];

        if (ButtonOperationTypes.includes(operationType as OperationType)) {
            widgets.push({ name: "Button", value: "Button" });
        }

        if (DisplayOperationTypes.includes(operationType as OperationType)) {
            widgets.push({ name: "Display", value: "Display" });
        }

        if (SwitchOperationTypes.includes(operationType as OperationType)) {
            widgets.push({ name: "Switch", value: "Switch" });
        }

        if (SliderOperationTypes.includes(operationType as OperationType)) {
            widgets.push({ name: "Slider", value: "Slider" });
        }

        if (operationType === "HexColor") {
            widgets.push({ name: "Color", value: "Color" });
        }

        if (operationType === "Options") {
            widgets.push({ name: "Radio", value: "Radio" });
        }

        if (widgets.length === 0) {
            console.error(
                "[WidgetForm] No valid widget types found for operation type:",
                operationType,
            );
            widgets.push({ name: "Invalid", value: "Invalid" });
        }

        return widgets;
    };

    const buttonClicked = async () => {
        if (loading) {
            console.info("[WidgetForm] Form is processing");
            return;
        }

        const validation = widgetDetails.validateDto();

        if (!validation) {
            console.info("[WidgetForm] Form is invalid", widgetDetails.widget);
            return;
        }

        setLoading(true);

        const values = widgetDetails.toAddDto();

        console.debug("[WidgetForm] Submitting form with values:", values);
        await onSubmit(values);

        setLoading(false);
    };

    useImperativeHandle(ref, () => ({
        triggerSave: buttonClicked,
    }));

    useEffect(() => {
        widgetDetails.validateDto();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetDetails.widget?.name, widgetDetails.widget?.type]);

    const typeSelected = (value: string) => {
        widgetDetails.setWidget({
            ...widgetDetails.widget!,
            type: value as WidgetType,
            configuration: {},
        });
    };

    const overrideName = (value: string) => {
        widgetDetails.setWidget({
            ...widgetDetails.widget!,
            name: value,
        });
    };

    const buttonVisible = () => {
        return !edit && !hideButton;
    };

    if (widgetDetails.operation === undefined || widgetDetails.widget === undefined) {
        return (
            <Text size="medium" color="error">
                {" "}
                Failed to initialize.{" "}
            </Text>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.displayContainer}>
                <View style={{ marginBottom: 20, marginTop: 10 }}>
                    <Text
                        style={{ paddingBottom: 10 }}
                        size="medium"
                        color="onBackground"
                        bold={true}>
                        Operation
                    </Text>
                    <OperationTile
                        id=""
                        name={widgetDetails.operation!.name}
                        type={widgetDetails.operation!.type}
                        disablePress={true}
                    />
                </View>

                <Text size="medium" color="onBackground" bold={true}>
                    Widget
                </Text>
                <WidgetListTile
                    id=""
                    name={widgetDetails.widget.name}
                    type={widgetDetails.widget.type}
                    enabled={widgetDetails.widget.enabled ?? true}
                    disablePress={true}
                />
            </View>

            <Divider style={{ paddingHorizontal: 15 }} />

            <KeyboardAwareScrollView
                bottomOffset={keyboardOffset}
                showsVerticalScrollIndicator={false}
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 80 }}>
                <View style={{ paddingHorizontal: 15 }}>
                    <Input
                        error={widgetDetails.errors.nameError}
                        value={widgetDetails.widget.name}
                        title="Name"
                        placeholder="Widget name"
                        setValue={overrideName}
                        editable={!edit}
                    />

                    <Dropdown
                        title={"Widget Type"}
                        options={getWidgetTypes()}
                        selectedValue={widgetDetails.widget.type}
                        onSelected={typeSelected}
                        disablePress={edit}
                        style={{ marginBottom: 10 }}
                    />

                    {widgetDetails.widget.type === "Button" && <ButtonForm edit={edit} />}
                    {widgetDetails.widget.type === "Display" && <DisplayForm edit={edit} />}
                    {widgetDetails.widget.type === "Slider" && <SliderForm edit={edit} />}
                    {widgetDetails.widget.type === "Radio" && <RadioForm edit={edit} />}
                </View>
            </KeyboardAwareScrollView>

            {buttonVisible() && (
                <View style={styles.buttonContainer}>
                    <ImageButton
                        size={40}
                        icon={"add-outline"}
                        loading={loading}
                        onPress={buttonClicked}
                    />
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 0,
        margin: 0,
        marginTop: 0,
    },
    displayContainer: {
        paddingHorizontal: 15,
        paddingTop: 5,
    },
    scrollContainer: {
        paddingHorizontal: 0,
        margin: 0,
    },
    buttonContainer: {
        position: "absolute",
        bottom: 0,
        right: 15,
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: 15,
    },
});

export default WidgetForm;
