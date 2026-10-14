import React, { useCallback, useState } from "react";
import { View, RefreshControl, SectionList } from "react-native";
import { useFocusEffect } from "expo-router";
import { useToast } from "@/contexts/ToastProvider";
import Loading from "@/components/common/Loading";
import { useDevice } from "@/contexts/custom/DeviceProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import { toOperationGroups } from "@/types/DeviceTypes";
import Text from "@/components/common/Text";
import WidgetListTile from "@/components/device/widgets/WidgetListTile";
import ImageButton from "@/components/common/ImageButton";
import { useRouter } from "expo-router";
import { WidgetListDto, OperationGroup, OperationGroupListDto } from "@/types/DeviceTypes";
import OperationTile from "../operation/OperationTile";

const EmptyWidget: WidgetListDto = {
    id: "",
    name: "",
    type: "Invalid",
    enabled: false,
    empty: true,
};

interface WidgetListProps {
    overrideOnClick?: (operationId: string) => Promise<void>;
    hideAddButtons?: boolean;
}

export default function WidgetList({ overrideOnClick, hideAddButtons = false }: WidgetListProps) {
    const api = useApi();
    const device = useDevice();
    const toast = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [groups, setGroups] = useState<OperationGroup[]>([]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        const refresh = async () => {
            const result = await call(
                () => api.widgets.displayWidgets({ deviceId: device.deviceId }),
                "Failed to refresh operations.",
            );

            if (result.isSuccess && result.data) {
                setGroups(toOperationGroups(result.data));
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
            () => api.widgets.displayWidgets({ deviceId: device.deviceId }),
            "Failed to load operations.",
        );

        if (result.isSuccess && result.data) {
            setGroups(toOperationGroups(result.data));
            setLoading(false);
        } else if (isNotFound(result)) {
            setGroups([]);
            setLoading(false);
            toast.info("Create some operations!");
        } else {
            toast.apiError(result);
            setLoading(false);
        }
    };

    const addWidgetClicked = async (operationId: string) => {
        console.info("[WidgetList] Add Widget Clicked.");
        router.push({ pathname: "device/widget/add", params: { operationId: operationId } });
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

    const displayWidget = (item: any) => {
        if (item.empty) {
            return (
                <View>
                    <Text size="medium" color="onBackground">
                        Operation has no widgets!
                    </Text>
                </View>
            );
        }

        return (
            <WidgetListTile
                id={item.id}
                name={item.name}
                type={item.type}
                enabled={item.enabled}
                overrideOnClick={overrideOnClick}
            />
        );
    };

    return (
        <SectionList
            sections={groups.map((x) => ({
                title: JSON.stringify(x.operation),
                data: x.widgets.length > 0 ? x.widgets : [EmptyWidget],
            }))}
            keyExtractor={(item, index) => item.id + index}
            renderItem={({ item }) => <View>{displayWidget(item)}</View>}
            renderSectionHeader={({ section }) => (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        alignContent: "center",
                        marginVertical: 8,
                    }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <OperationTile
                            id={(JSON.parse(section.title) as OperationGroupListDto).id}
                            name={(JSON.parse(section.title) as OperationGroupListDto).name}
                            type={(JSON.parse(section.title) as OperationGroupListDto).type}
                        />
                    </View>

                    {!hideAddButtons && (
                        <ImageButton
                            size={25}
                            icon="add-outline"
                            onPress={() => {
                                addWidgetClicked(
                                    (JSON.parse(section.title) as OperationGroupListDto).id,
                                );
                            }}
                        />
                    )}
                </View>
            )}
            contentContainerStyle={{
                paddingHorizontal: 15,
                paddingTop: 15,
                paddingBottom: 120,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
        />
    );
}
