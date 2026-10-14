import { View, StyleSheet } from "react-native";
import Input from "@/components/common/Input";
import { useEffect, useState } from "react";
import Text from "@/components/common/Text";
import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import ImageButton from "@/components/common/ImageButton";
import { useDeviceList } from "@/contexts/custom/DeviceListProvider";
import Dropdown, { Option } from "@/components/common/Dropdown";
import { useAutomation } from "@/contexts/custom/AutomationProvider";
import { useRouter } from "expo-router";

interface AutomationResultFormProps {
    automationId: string;
    edit: boolean;
    onButtonClick: (values: any) => void;
    deviceId?: string;
    resultOperationId?: string;
    valueToSend?: string;
}

const baseDevices: Option[] = [{ name: "Select a device", value: "None" }];
const baseOperations: Option[] = [{ value: "None", name: "Select Operation" }];

export default function AutomationResultForm({
    automationId,
    edit,
    onButtonClick,
    deviceId: initialDeviceId = "None",
    resultOperationId: initialResultOperationId,
    valueToSend: initialValueToSend,
}: AutomationResultFormProps) {
    const router = useRouter();
    const toast = useToast();
    const api = useApi();
    const devices = useDeviceList();

    const [resultOperationId, setResultOperationId] = useState<string>(
        edit && automationId ? initialResultOperationId! : "",
    );
    const [resultOperationOptionList, setResultOperationOptionList] = useState<Option[]>([]);

    const [resultOperationName, setResultOperationName] = useState<string>("");
    const [valueToSend, setValueToSend] = useState<string>(
        (edit && automationId ? initialValueToSend : "") ?? "",
    );
    const [deviceId, setDeviceId] = useState<string>(
        edit && automationId ? initialDeviceId : "None",
    );

    const [deviceOptions, setDeviceOptions] = useState<Option[]>([]);

    const [operationsForSelectedDevice, setOperationsForSelectedDevice] = useState<Option[]>([]);

    const [loading, setLoading] = useState<boolean>(false);

    const automationDetails = useAutomation();

    useEffect(() => {
        setDeviceOptions([
            ...baseDevices,
            ...devices.devices.map((device) => ({ name: device.name, value: device.id })),
        ]);
    }, [devices.devices]);

    useEffect(() => {
        getOperationsForDevice(deviceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceId]);

    const setOperations = (operations: Option[]) => {
        setOperationsForSelectedDevice(operations);
        setResultOperationOptionList([...baseOperations, ...operations]);
    };

    const getOperationsForDevice = async (deviceId: string) => {
        if (!deviceId || deviceId === "None") {
            setLoading(false);
            return;
        }

        const result = await call(() =>
            api.operations.displayOperations({ deviceId, page: 0, size: 0 }),
        );

        if (result.isSuccess && result.data) {
            const operationOptions = result.data.items.map((operation) => ({
                name: operation.name,
                value: operation.id,
            }));
            setOperations(operationOptions);
            setResultOperationId("None");
        } else if (isNotFound(result)) {
            setOperations([]);
            toast.info("Create some operations!");
        } else {
            toast.apiError(result);
        }
        setLoading(false);
    };

    const setDeviceIdAndResetOptions = (deviceId: string) => {
        setLoading(true);
        setDeviceId(deviceId);
        setDeviceOptions(
            devices.devices.map((device) => ({ name: device.name, value: device.id })),
        );
    };

    const setResultOperation = (operationId: string) => {
        setResultOperationId(operationId);
        const operation = operationsForSelectedDevice.find((op) => op.value === operationId);
        setResultOperationName(operation ? operation.name : "");
        setResultOperationOptionList(operationsForSelectedDevice);
    };

    const validateForm = () => {
        setLoading(true);
        if (!valueToSend || !resultOperationId || resultOperationId === "None") {
            toast.error("Please fill all fields.");
            setLoading(false);
            return false;
        }
        setLoading(false);
        return true;
    };

    const onSubmit = () => {
        setLoading(true);
        if (!validateForm()) {
            setLoading(false);
            return false;
        }

        const automationResult = {
            value: valueToSend, // TODO: Mismatch in backend naming, should be unified
            operationId: resultOperationId,
            operationName: resultOperationName,
        };

        onButtonClick(automationResult);

        automationDetails.addResult({
            valueToSend: valueToSend,
            operationId: resultOperationId,
            operationName: resultOperationName,
        });
        setLoading(false);
        return true;
    };

    const isOperationForSelectedDeviceEmpty = operationsForSelectedDevice.length <= 1;

    return (
        <View style={styles.wrapper}>
            <Dropdown
                selectedValue={deviceId}
                title={"Device"}
                options={deviceOptions}
                onSelected={(value) => setDeviceIdAndResetOptions(value)}
            />

            {!loading && deviceId !== "None" && isOperationForSelectedDeviceEmpty && (
                <Text style={styles.error} size={"small"} color={"error"}>
                    Selected device does not have any operations. Please select another device or
                    create operations for this device.
                </Text>
            )}

            {!isOperationForSelectedDeviceEmpty && (
                <Dropdown
                    selectedValue={resultOperationId}
                    title={"Operation"}
                    options={resultOperationOptionList}
                    onSelected={(value) => setResultOperation(value)}
                />
            )}

            <Input
                error={""}
                value={valueToSend}
                title="Value to send"
                placeholder="Value to send"
                setValue={setValueToSend}
            />

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

    buttonContainer: {
        // TODO: Copied from AutomationForm, should be moved to common styles
        position: "absolute",
        bottom: 0,
        right: 15,
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: 15,
    },

    error: {
        // TODO: Copied from Input, should be moved to common styles
        marginTop: 0,
        marginBottom: 5,
    },
});
