import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple, isNotFound } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useTheme } from "@/contexts/ThemeProvider";
import { SubscriptionDto } from "@/types/DataSourcesTypes";
import { shadowStyles } from "@/styles/shadowStyles";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { FC, useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Text from "@/components/common/Text";
import Icon from "@/components/common/Icon";

const BrokerSubscriptions: FC = () => {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = idParam ?? "";
    const api = useApi();
    const toast = useToast();
    const theme = useTheme();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const load = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            try {
                const result = await call(() =>
                    api.dataSources.getSubscribtions({ brokerId: id, page: 1, size: 400 }),
                );
                if (result.isSuccess) {
                    setSubscriptions(result.data!.items.map(({ id, topic }) => ({ id, topic })));
                } else if (isNotFound(result)) {
                    setSubscriptions([]);
                } else {
                    toast.apiError(result);
                }
            } finally {
                if (isRefresh) setRefreshing(false);
                else setLoading(false);
            }
        },
        [id, api, toast],
    );

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const confirmDelete = (subscriptionId: string) => {
        setPendingDeleteId(subscriptionId);
    };

    const onDelete = async (subscriptionId: string) => {
        setLoading(true);
        try {
            const result = await callSimple(() =>
                api.dataSources.deleteSubscribtion({ brokerId: id, subscriptionId }),
            );
            if (result.isSuccess) {
                toast.success("Subscription removed.");
                load();
            } else {
                toast.apiError(result);
            }
        } finally {
            setLoading(false);
        }
    };

    const onAdd = () => {
        router.push({
            pathname: "dataSource/brokers/addSubscription",
            params: { brokerId: id },
        });
    };

    if (loading && !refreshing) return <Loading size={64} />;

    const fabActions: FABAction[] = [
        { icon: "add-outline", label: "Add Subscription", onPress: onAdd },
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={pendingDeleteId !== null}
                title="Remove Subscription"
                content="Broker will not register any events incoming to this topic. This action cannot be undone."
                onConfirm={() => {
                    const id = pendingDeleteId!;
                    setPendingDeleteId(null);
                    onDelete(id);
                }}
                onCancel={() => setPendingDeleteId(null)}
            />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
                }>
                {subscriptions.length === 0 ? (
                    <View style={styles.empty}>
                        <Text size="medium" color="onBackground">
                            No subscriptions yet.
                        </Text>
                    </View>
                ) : (
                    subscriptions.map((item) => (
                        <View
                            key={item.id}
                            style={[
                                styles.tile,
                                shadowStyles.default,
                                { backgroundColor: theme.current.colors.primary },
                            ]}>
                            <View style={styles.tileIcon}>
                                <Icon icon="git-merge-outline" size={24} color="onPrimary" />
                            </View>
                            <View style={styles.tileContent}>
                                <Text size="medium" color="onPrimary" bold={true}>
                                    {item.topic}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.tileDelete}
                                onPress={() => confirmDelete(item.id)}>
                                <Icon icon="trash-outline" size={22} color="error" />
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>

            <FAB actions={fabActions} />
        </View>
    );
};

export default BrokerSubscriptions;

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 90,
    },
    empty: {
        alignItems: "center",
        marginTop: 30,
    },
    tile: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 12,
        marginBottom: 10,
    },
    tileIcon: {
        paddingRight: 12,
    },
    tileContent: {
        flex: 1,
    },
    tileDelete: {
        paddingLeft: 12,
    },
});
