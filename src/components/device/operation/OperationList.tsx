import Loading from "@/components/common/Loading";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import { OperationType } from "@/types/DeviceTypes";
import { useToast } from "@/contexts/ToastProvider";
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import Text from "@/components/common/Text";
import { useFocusEffect } from "expo-router";
import { useDevice } from "@/contexts/custom/DeviceProvider";
import { OperationListDto } from "@/contexts/custom/DeviceListProvider";
import OperationTile from "./OperationTile";

function OperationList() {
    const device = useDevice();
    const toast = useToast();
    const api = useApi();
    const [loading, setLoading] = useState(true);
    const [oprations, setOperations] = useState<OperationListDto[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        const refresh = async () => {
            const result = await call(
                () =>
                    api.operations.displayOperations({
                        deviceId: device.deviceId,
                        page: 0,
                        size: 0,
                    }),
                "Failed to refresh operations.",
            );

            if (result.isSuccess && result.data) {
                setOperations(
                    result.data.items.map((i) => ({
                        id: i.id,
                        name: i.name,
                        type: i.type as OperationType,
                    })),
                );
                setRefreshing(false);
            } else {
                toast.apiError(result);
                setRefreshing(false);
            }
        };

        refresh();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getOperations = async () => {
        const result = await call(
            () => api.operations.displayOperations({ deviceId: device.deviceId, page: 0, size: 0 }),
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
            setLoading(false);
        } else if (isNotFound(result)) {
            setOperations([]);
            setLoading(false);
            toast.info("Create some operations!");
        } else {
            toast.apiError(result);
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            getOperations();

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
    );

    if (loading) {
        return <Loading />;
    }

    return (
        <View style={{ paddingTop: 15, flex: 1 }}>
            <FlatList
                data={oprations}
                keyExtractor={(item, index) => index.toString()}
                style={{ paddingHorizontal: 15, flex: 1 }}
                renderItem={({ item }) => (
                    <OperationTile id={item.id} name={item.name} type={item.type} />
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text size={"medium"} color={"onBackground"}>
                            No available operations.
                        </Text>
                    </View>
                }
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                contentContainerStyle={{ paddingVertical: 10, paddingBottom: 150, gap: 10 }}
                removeClippedSubviews={false}
            />
        </View>
    );
}

export default OperationList;
