import InputNumber from "@/components/common/InputNumber";
import UserNote from "@/components/common/UserNote";
import { OperationType } from "@/types/DeviceTypes";
import { useWidgetDetails } from "@/contexts/custom/WidgetDetailsProvider";
import { useFocusEffect } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

interface SliderFormProps {
    edit?: boolean;
}

export const SliderOperationTypes: OperationType[] = ["Number", "Integer"];

const SliderForm = ({ edit }: SliderFormProps) => {
    const widgetDetails = useWidgetDetails();

    const configurationMin = widgetDetails.operation?.configuration?.min;
    const configurationMax = widgetDetails.operation?.configuration?.max;

    const hasNoRange =
        configurationMin === undefined ||
        configurationMax === undefined ||
        (widgetDetails.operation?.type === "Integer" &&
            configurationMin === INT32_MIN &&
            configurationMax === INT32_MAX) ||
        (widgetDetails.operation?.type === "Number" &&
            configurationMin === -Number.MAX_VALUE &&
            configurationMax === Number.MAX_VALUE);

    const rangeMin = configurationMin ?? 0;
    const rangeMax = configurationMax ?? 100;

    const [step, setStep] = useState<number | undefined>(widgetDetails.widget?.configuration.step);
    const stepValidRef = useRef<boolean>(step !== undefined);

    const onStepChange = (value: number | undefined) => {
        stepValidRef.current = value !== undefined;
        setStep(value);
        if (value !== undefined) {
            widgetDetails.setWidget({
                ...widgetDetails.widget!,
                configuration: {
                    ...widgetDetails.widget?.configuration,
                    step: value,
                },
            });
        }
    };

    const validate = (): boolean => stepValidRef.current;

    useFocusEffect(() => {
        widgetDetails.setAdditionalValidation(validate);
    });

    return (
        <View
            style={{
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
            {hasNoRange ? (
                <UserNote
                    text="Selected operation has no range defined. Slider requires a valid min/max range to function correctly. Set the range in the operation configuration."
                    style={{ paddingHorizontal: 0, paddingTop: 5, paddingBottom: 10 }}
                />
            ) : (
                <UserNote
                    text="Verify that the selected operation has a values range set. Otherwise the slider will fail to validate."
                    style={{ paddingHorizontal: 0, paddingTop: 5, paddingBottom: 10 }}
                />
            )}

            <InputNumber
                title="Slider Step"
                value={step}
                onChange={onStepChange}
                integer={widgetDetails.operation?.type === "Integer"}
                min={widgetDetails.operation?.type === "Integer" ? 1 : 0.0001}
                max={rangeMax - rangeMin}
                required
                editable={!edit}
                placeholder={
                    widgetDetails.operation?.type === "Integer"
                        ? `e.g. 1 — max ${rangeMax - rangeMin}`
                        : `e.g. 0.0001 — max ${rangeMax - rangeMin}`
                }
            />
        </View>
    );
};

export default SliderForm;
