import { View, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import Input from "@/components/common/Input";
import Text from "@/components/common/Text";
import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import { OperationType } from "@/types/DeviceTypes";
import ImageButton from "@/components/common/ImageButton";
import { useDeviceList } from "@/contexts/custom/DeviceListProvider";
import Dropdown, { Option } from "@/components/common/Dropdown";
import SwitchDropdown from "@/components/common/SwitchDropdown";
import { OperationListDto } from "@/contexts/custom/DeviceListProvider";
import { useAutomation } from "@/contexts/custom/AutomationProvider";
import { ConditionType, OperationToConditionMap } from "@/types/AutomationsTypes";
import { useRouter } from "expo-router";

interface AutomationConditionFormProps {
    automationId: string;
    edit: boolean;
    onButtonClick: (values: any) => void;
    deviceId?: string;
    conditionOperationId?: string;
    conditionType?: ConditionType;
    conditionConfiguration?: any;
}

const baseDevices: Option[] = [{ name: "Select a device", value: "None" }];
const baseOperations: Option[] = [{ value: "None", name: "Select Operation" }];

export default function AutomationConditionForm({
    automationId,
    edit,
    onButtonClick,
    deviceId: initialDeviceId = "None",
    conditionOperationId: initialConditionOperationId,
    conditionType: initialConditionType,
    conditionConfiguration: initialConditionConfiguration,
}: AutomationConditionFormProps) {
    const router = useRouter();
    const toast = useToast();
    const api = useApi();
    const devices = useDeviceList();
    const automationDetails = useAutomation();

    const [deviceId, setDeviceId] = useState<string>(
        edit && automationId ? initialDeviceId : "None",
    );
    const [operationId, setOperationId] = useState<string>(
        edit && automationId ? initialConditionOperationId! : "",
    );
    const [conditionOperationOptionList, setConditionOperationOptionList] = useState<Option[]>([]);

    const [operationName, setOperationName] = useState<string>("");
    const [operationsForSelectedDevice, setOperationsForSelectedDevice] = useState<
        OperationListDto[]
    >([]);
    const [loading, setLoading] = useState<boolean>(false);

    const [conditionType, setConditionType] = useState<ConditionType>(
        edit && automationId && initialConditionType ? initialConditionType : "InvalidCondition",
    );

    const [isOn, setIsOn] = useState<boolean>(initialConditionConfiguration?.isOn ?? true);
    const [minValue, setMinValue] = useState<string>(
        initialConditionConfiguration?.minValue?.toString() ?? "",
    );
    const [maxValue, setMaxValue] = useState<string>(
        initialConditionConfiguration?.maxValue?.toString() ?? "",
    );
    const [requiredValue, setRequiredValue] = useState<string>(
        initialConditionConfiguration?.requiredValue ?? "",
    );

    const [deviceOptions, setDeviceOptions] = useState<Option[]>([]);

    useEffect(() => {
        getOperationsForDevice(deviceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceId]);

    useEffect(() => {
        setDeviceOptions([
            ...baseDevices,
            ...devices.devices.map((device) => ({ name: device.name, value: device.id })),
        ]);
    }, [devices.devices]);

    const setDeviceIdAndResetOptions = (deviceId: string) => {
        setLoading(true);
        setDeviceId(deviceId);
        setDeviceOptions(
            devices.devices.map((device) => ({ name: device.name, value: device.id })),
        );
    };

    const setOperations = (operations: OperationListDto[]) => {
        const operationOptions = operations.map((operation) => ({
            name: operation.name,
            value: operation.id,
        }));
        setOperationsForSelectedDevice(operations);
        setConditionOperationOptionList([...baseOperations, ...operationOptions]);
    };

    const getOperationsForDevice = async (deviceId: string) => {
        if (!deviceId || deviceId === "None") {
            setLoading(false);
            return;
        }

        const result = await call(
            () => api.operations.displayOperations({ deviceId, page: 0, size: 0 }),
            "Failed to load operations.",
        );

        if (result.isSuccess && result.data) {
            setOperations(
                result.data.items.map((i) => ({
                    id: i.id,
                    name: i.name,
                    type: i.type as OperationType,
                })),
            );
            setOperationId("None");
        } else if (isNotFound(result)) {
            setOperations([]);
            toast.info("Create some operations!");
        } else {
            toast.apiError(result);
        }
        setLoading(false);
    };

    const setConditionOperation = (opId: string) => {
        setOperationId(opId);
        const operation = operationsForSelectedDevice.find((op) => op.id === opId)!;
        setOperationName(operation ? operation.name : "");

        const operationType = operation.type;
        setConditionType(OperationToConditionMap[operationType]);
        setConditionOperationOptionList(
            operationsForSelectedDevice.map((op) => ({ name: op.name, value: op.id })),
        );
    };

    const validateForm = () => {
        if (!operationId || operationId === "None") {
            toast.error("Please select an operation.");
            return false;
        }

        if (conditionType === "TextCondition" && !requiredValue) {
            toast.error("Please provide a required value.");
            return false;
        }

        if (conditionType === "NumberCondition" && (!minValue || !maxValue)) {
            toast.error("Please provide both min and max values.");
            return false;
        }

        if (
            conditionType === "NumberCondition" &&
            (isNaN(Number(minValue)) || isNaN(Number(maxValue)))
        ) {
            toast.error("Min and Max values must be numbers.");
            return false;
        }

        return true;
    };

    const onSubmit = () => {
        setLoading(true);
        if (!validateForm()) {
            setLoading(false);
            return false;
        }

        let config: any = {};
        if (conditionType === "BooleanCondition") {
            config = { isOn: isOn };
        } else if (conditionType === "NumberCondition") {
            config = { minValue: Number(minValue), maxValue: Number(maxValue) };
        } else if (conditionType === "TextCondition") {
            config = { requiredValue: requiredValue };
        }

        const automationCondition = {
            operationId: operationId,
            operationName: operationName,
            conditionType: conditionType,
            conditionConfiguration: config,
        };

        onButtonClick(automationCondition);

        if (automationDetails.addCondition) {
            automationDetails.addCondition(automationCondition);
        }

        setLoading(false);
        return true;
    };

    const isConditionOperationForSelectedDeviceEmpty = conditionOperationOptionList.length <= 1;

    return (
        <View style={styles.wrapper}>
            <Dropdown
                selectedValue={deviceId}
                title={"Device"}
                options={deviceOptions}
                onSelected={(value) => setDeviceIdAndResetOptions(value)}
            />

            {!loading && deviceId !== "None" && isConditionOperationForSelectedDeviceEmpty && (
                <Text style={styles.error} size={"small"} color={"error"}>
                    Selected device does not have any operations. Please select another device or
                    create operations for this device.
                </Text>
            )}

            {!isConditionOperationForSelectedDeviceEmpty && (
                <Dropdown
                    selectedValue={operationId}
                    title={"Operation"}
                    options={conditionOperationOptionList}
                    onSelected={(value) => setConditionOperation(value)}
                />
            )}

            <View style={styles.dynamicConfigContainer}>
                {conditionType === "TextCondition" && (
                    <Input
                        error={""}
                        value={requiredValue}
                        title="Required Value"
                        placeholder="Enter exact text"
                        setValue={setRequiredValue}
                    />
                )}

                {conditionType === "NumberCondition" && (
                    <View style={styles.row}>
                        <View style={{ flex: 1, paddingRight: 5 }}>
                            <Input
                                error={""}
                                value={minValue}
                                title="Min Value"
                                placeholder="0"
                                setValue={setMinValue}
                            />
                        </View>
                        <View style={{ flex: 1, paddingLeft: 5 }}>
                            <Input
                                error={""}
                                value={maxValue}
                                title="Max Value"
                                placeholder="100"
                                setValue={setMaxValue}
                            />
                        </View>
                    </View>
                )}

                {conditionType === "BooleanCondition" && (
                    <SwitchDropdown
                        title="Condition Requirement"
                        value={isOn}
                        onSelected={setIsOn}
                        trueLabel="Met when device is ON"
                        falseLabel="Met when device is OFF"
                    />
                )}
            </View>

            <View style={styles.buttonContainer}>
                <ImageButton
                    size={40}
                    icon={edit ? "checkmark-outline" : "add-outline"}
                    loading={loading}
                    onPress={() => {
                        if (onSubmit()) {
                            router.back();
                        }
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        gap: 10,
        paddingHorizontal: 15,
    },
    sectionTitle: {
        marginTop: 10,
        marginBottom: 5,
        fontWeight: "bold",
    },
    radioGroup: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 15,
    },
    blockRadioGroup: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#ccc",
    },
    blockButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    blockButtonText: {
        fontSize: 14,
        fontWeight: "500",
    },
    blockButtonTextSelected: {
        fontWeight: "bold",
    },
    dynamicConfigContainer: {
        marginBottom: 60,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    buttonContainer: {
        position: "absolute",
        bottom: 0,
        right: 15,
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: 15,
    },
    error: {
        marginTop: 0,
        marginBottom: 5,
    },
});
