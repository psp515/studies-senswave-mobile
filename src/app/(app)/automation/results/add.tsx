import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useLocalSearchParams } from "expo-router";
import AutomationResultForm from "@/components/automations/results/AutomationResultForm";

export default function AddAutomationResult() {
    const automationId = useLocalSearchParams<{ automationId?: string }>().automationId;
    console.log("Automation id: ", automationId);

    const toast = useToast();
    const api = useApi();
    const edit = automationId !== undefined;

    const addToExistingAutomation = async (values: any) => {
        console.info(
            "[AutomationResultAdd] Submitting automation result for automationId: ",
            automationId,
            " with values: ",
            values,
        );

        const result = await callSimple(
            () =>
                api.automations.putResultToAutomation({
                    automationId: automationId ?? "",
                    operationId: values.operationId,
                    value: String(values.value),
                }),
            "Failed to add automation result.",
        );

        if (result.isSuccess) {
            toast.success("Automation result added successfully.");
        } else {
            toast.apiError(result);
        }
    };

    const addToNewAutomation = async (values: any) => {
        console.info("[AutomationResultAdd] Adding result to new automation with values: ", values);
    };

    const onButtonClick = edit ? addToExistingAutomation : addToNewAutomation;

    return (
        <AutomationResultForm
            automationId={automationId ?? ""}
            edit={edit}
            onButtonClick={onButtonClick}
        />
    );
}
