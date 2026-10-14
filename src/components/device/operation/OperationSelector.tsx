import { View, StyleSheet } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import ImageButton from "@/components/common/ImageButton";
import Loading from "@/components/common/Loading";
import Dropdown, { Option } from "@/components/common/Dropdown";
import ButtonWithTextAndImage from "@/components/common/ButtonWithTextAndImage";
import { useHttpClient } from "@/contexts/HttpClientProvider";
import { ListResponse } from "@/utils/httpClient";
import { useToast } from "@/contexts/ToastProvider";
import { OperationListDto } from "@/contexts/custom/DeviceListProvider";
import { OperationType } from "@/types/DeviceTypes";

interface OperationSelectorProps {
    deviceId: string;
    initialOperationId?: string;
    filterTypes: OperationType[];
    onSelected: (value: string) => void;
}

const EmptyOption: Option = {
    name: "No Operation Selected",
    value: "None",
};

function OperationSelector({
    deviceId,
    initialOperationId,
    onSelected: handleSelected,
    filterTypes,
}: OperationSelectorProps) {
    const toast = useToast();
    const router = useRouter();
    const httpClient = useHttpClient();

    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<Option[]>([]);

    const addClicked = () => {
        router.push({
            pathname: "device/operation/add",
            params: {
                deviceId: deviceId,
            },
        });
    };

    const handleInternalSelected = (value: string) => {
        handleSelected(value);
    };

    const getOperations = async () => {
        if (loading) return;

        setLoading(true);
        const result = await httpClient.get(
            `v1/devices/operations/display?deviceId=${deviceId}&page=1&size=100`,
        );

        if (result.isSuccess) {
            const content = (await result.response!.json()) as ListResponse<OperationListDto>;

            const operations = content.items
                .filter((item) => filterTypes.includes(item.type))
                .map((item) => ({
                    name: `${item.type} - ${item.name}`,
                    value: item.id,
                }));

            operations.unshift(EmptyOption);
            setOptions(operations);
        } else if (result.statusCode === 404) {
            setOptions([EmptyOption]);
        } else {
            toast.error("Failed to load operations.");
        }

        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            getOperations();

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
    );

    useEffect(() => {
        getOperations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return <Loading size={32} />;
    }

    const hasOperations = options.length > 1;

    if (!hasOperations) {
        return (
            <ButtonWithTextAndImage
                title="Add Operation"
                loading={false}
                onPress={addClicked}
                style={{ padding: 0 }}
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.dropdown}>
                <Dropdown
                    selectedValue={
                        initialOperationId && initialOperationId !== ""
                            ? initialOperationId
                            : EmptyOption.value
                    }
                    title="Select Operation"
                    options={options}
                    onSelected={handleInternalSelected}
                />
            </View>
            <View style={styles.add}>
                <View>
                    <ImageButton icon="add-outline" onPress={addClicked} size={24} />
                </View>
            </View>
        </View>
    );
}

export default OperationSelector;

const styles = StyleSheet.create({
    container: {
        alignItems: "flex-end",
        width: "100%",
        flexDirection: "row",
    },
    dropdown: {
        flex: 1,
        paddingRight: 10,
    },
    add: {
        alignItems: "flex-end",
    },
});
