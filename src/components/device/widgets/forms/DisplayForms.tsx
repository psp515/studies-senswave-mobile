import React, { useEffect, useState } from "react";
import Input from "@/components/common/Input";
import { useWidgetDetails } from "@/contexts/custom/WidgetDetailsProvider";
import { View } from "react-native";
import { OperationType } from "@/types/DeviceTypes";

interface DisplayFormProps {
    edit?: boolean;
}

export const DisplayOperationTypes: OperationType[] = ["Text", "Number", "Integer"];

const DisplayForm = ({ edit }: DisplayFormProps) => {
    const widgetDetails = useWidgetDetails();

    const configurationUnit = widgetDetails.widget?.configuration?.unit ?? "";

    const [unit, setUnit] = useState<string>(configurationUnit);
    const [unitError, setUnitError] = useState<string>("");

    const validate = (): boolean => {
        const regex = /^([a-zA-Z0-9°µΩ‰%±+\-?℃℉]{1,10})?$/;
        let valid = true;

        console.info("[ButtonForm] Validating Display widget.");

        if (unit.length === 0) {
            valid = true;
            setUnitError("");
        } else if (unit.length > 10) {
            valid = false;
            setUnitError("Too long unit to display.");
        } else if (!regex.test(unit)) {
            valid = false;
            setUnitError("Used not allowed character.");
        } else {
            valid = true;
        }

        return valid;
    };

    const onUnitValueChange = (value: string) => {
        setUnit(value);

        widgetDetails.setWidget({
            ...widgetDetails.widget!,
            configuration: {
                ...widgetDetails.widget?.configuration,
                unit: value,
            },
        });
    };

    useEffect(() => {
        widgetDetails.setAdditionalValidation(validate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetDetails.widget?.configuration.unit]);

    useEffect(() => {
        widgetDetails.validateDto();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetDetails.widget?.configuration.unit]);

    useEffect(() => {
        widgetDetails.setWidget({
            ...widgetDetails.widget!,
            configuration: {
                ...widgetDetails.widget?.configuration,
                unit: configurationUnit,
            },
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Input
                error={unitError}
                value={unit}
                title="Unit"
                placeholder="No unit"
                setValue={onUnitValueChange}
                editable={!edit}
            />
        </View>
    );
};

export default DisplayForm;
