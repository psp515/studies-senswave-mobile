import Loading from "@/components/common/Loading";
import { useApi } from "@/contexts/ApiProvider";
import { useToast } from "@/contexts/ToastProvider";
import { useState } from "react";
import AutomationForm from "@/components/automations/AutomationForm";
import { useAutomationList } from "@/contexts/custom/AutomationListProvider";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { callSimple } from "@/api/call";
import {
    AutomationConditionDto,
    AutomationResultDto,
    connectorFromString,
    toConditionMessage,
    toResultMessage,
} from "@/types/AutomationsTypes";

function Add() {
    const api = useApi();
    const toast = useToast();
    const automations = useAutomationList();
    const [loading, setLoading] = useState<boolean>(false);
    const homes = useHomes();

    const addClicked = async (values: any) => {
        setLoading(true);

        values.homeId = homes.current?.id; // TODO: Should be handled somehow when current home is undefined ?

        console.info("[Automation Add] Submitting values: ", values);

        const result = await callSimple(
            () =>
                api.automations.createAutomation({
                    homeId: values.homeId,
                    name: values.name ?? "",
                    icon: values.icon ?? "",
                    conditionConnector: connectorFromString(values.conditionConnector),
                    conditions: ((values.conditions ?? []) as AutomationConditionDto[]).map(
                        toConditionMessage,
                    ),
                    results: ((values.results ?? []) as AutomationResultDto[]).map(toResultMessage),
                }),
            "Failed to add automation.",
        );

        if (result.isSuccess) {
            toast.success("Automation created successfully.");
            await automations.refresh();
        } else {
            toast.apiError(result);
        }
        setLoading(false);
    };

    if (loading) return <Loading />;

    return <AutomationForm onSubmit={addClicked} edit={false} />;
}

export default Add;
