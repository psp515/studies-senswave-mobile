import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import { useApi } from "@/contexts/ApiProvider";
import { useToast } from "@/contexts/ToastProvider";
import {
    AutomationConditionDto,
    AutomationDto,
    AutomationResultDto,
    connectorFromString,
    toAutomationDto,
    toConditionMessage,
    toResultMessage,
} from "@/types/AutomationsTypes";
import { call, callSimple } from "@/api/call";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import AutomationForm, { AutomationFormHandle } from "@/components/automations/AutomationForm";
import { useAutomationList } from "@/contexts/custom/AutomationListProvider";

function Details() {
    const { automationId: automationIdParam } = useLocalSearchParams<{ automationId: string }>();
    const id = automationIdParam ?? "";
    const [automation, setAutomation] = useState<AutomationDto | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const api = useApi();
    const toast = useToast();
    const automations = useAutomationList();
    const formRef = useRef<AutomationFormHandle>(null);

    useEffect(() => {
        const getAutomation = async () => {
            setLoading(true);
            const result = await call(
                () => api.automations.getAutomation({ automationId: id }),
                "Failed to load automation details.",
            );

            if (result.isSuccess) {
                const content = toAutomationDto(result.data!.automation!);
                console.log("Fetched Automation: ", content);
                setAutomation(content);
            } else {
                toast.apiError(result);
            }
            setLoading(false);
        };

        getAutomation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const deleteAutomation = async () => {
        console.log("[AutomationDetails] Delete Automation trigger");
        const result = await callSimple(
            () => api.automations.deleteAutomation({ automationId: id }),
            "Failed to delete automation.",
        );

        if (result.isSuccess) {
            toast.success("Automation deleted successfully.");
            await automations.refresh();
        } else {
            toast.apiError(result);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    const editClicked = async (values: any) => {
        console.log("[Automation Details] Submitting values: ", values);

        if ("isEnabled" in values) {
            await callSimple(() =>
                api.automations.automationState({
                    automationId: id,
                    isEnabled: values.isEnabled,
                }),
            );
        }

        const result = await callSimple(
            () =>
                api.automations.updateAutomation({
                    automationId: id,
                    name: values.name ?? "",
                    icon: values.icon ?? "",
                    conditionConnector: connectorFromString(values.conditionConnector),
                    conditions: ((values.conditions ?? []) as AutomationConditionDto[]).map(
                        toConditionMessage,
                    ),
                    results: ((values.results ?? []) as AutomationResultDto[]).map(toResultMessage),
                }),
            "Failed to update automation.",
        );

        if (result.isSuccess) {
            toast.success("Automation updated successfully.");
            await automations.refresh();
        } else {
            toast.apiError(result);
        }
    };

    if (loading) return <Loading />;

    const fabActions: FABAction[] = [
        ...(isFormDirty
            ? [
                  {
                      icon: "checkmark-outline",
                      label: "Save",
                      onPress: () => formRef.current?.triggerSave(),
                  },
              ]
            : []),
        { icon: "trash-outline", label: "Delete", onPress: deleteClicked },
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Automation"
                content="This automation and all its conditions and results will be permanently deleted. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteAutomation();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <AutomationForm
                ref={formRef}
                automationId={automation?.id}
                initName={automation?.name}
                initIcon={automation?.icon}
                initIsEnabled={automation?.isEnabled}
                initConditionConnector={automation?.conditionConnector}
                initConditions={automation?.conditions}
                initResults={automation?.results}
                onSubmit={editClicked}
                edit={true}
                onDirtyChange={setIsFormDirty}
                hideInternalButton={true}
            />
            <FAB actions={fabActions} />
        </View>
    );
}

export default Details;
