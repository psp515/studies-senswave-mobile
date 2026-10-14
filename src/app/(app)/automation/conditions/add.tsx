import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { conditionTypeFromString } from "@/types/AutomationsTypes";
import { useLocalSearchParams } from "expo-router";
import AutomationConditionForm from "@/components/automations/conditions/AutomationConditionForm";

export default function AddAutomationCondition() {
    const automationId = useLocalSearchParams().automationId as string;
    console.log("Automation id: ", automationId);

    const toast = useToast();
    const api = useApi();
    const edit = automationId !== undefined;

    const addToExistingAutomation = async (values: any) => {
        console.info(
            "[AutomationConditionAdd] Submitting automation condition for automationId: ",
            automationId,
            " with values: ",
            values,
        );

        const result = await callSimple(
            () =>
                api.automations.putConditionToAutomation({
                    automationId,
                    operationId: values.operationId,
                    conditionType: conditionTypeFromString(values.conditionType),
                    conditionConfiguration: values.conditionConfiguration,
                }),
            "Failed to add automation condition.",
        );

        if (result.isSuccess) {
            toast.success("Automation condition added successfully.");
        } else {
            toast.apiError(result);
        }
    };

    const addToNewAutomation = async (values: any) => {
        console.info(
            "[AutomationConditionAdd] Adding condition to new automation with values: ",
            values,
        );
    };

    const onButtonClick = edit ? addToExistingAutomation : addToNewAutomation;

    return (
        <AutomationConditionForm
            automationId={automationId}
            edit={edit}
            onButtonClick={onButtonClick}
        />
    );
}
