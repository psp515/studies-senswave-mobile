import Loading from "@/components/common/Loading";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import Text from "@/components/common/Text";
import HomeListItem from "./HomeListItem";
import { useFocusEffect } from "expo-router";
import { HomeListItemDto } from "@/types/HomeTypes";

function HomeList() {
    const toast = useToast();
    const homes = useHomes();
    const api = useApi();
    const [loading, setLoading] = useState(true);
    const [homesList, setHomesList] = useState<HomeListItemDto[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        const refresh = async () => {
            const result = await call(() => api.homes.getHomes({ page: 0, size: 0 }));

            if (result.isSuccess) {
                const filtered = result.data!.items.filter((home) => home.id !== homes.current?.id);
                setHomesList(filtered);
                setRefreshing(false);
            } else {
                toast.apiError(result, "Failed to load homes.");
                setRefreshing(false);
            }
        };

        refresh();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getHomes = async () => {
        const result = await call(() => api.homes.getHomes({ page: 0, size: 0 }));

        if (result.isSuccess) {
            const filtered = result.data!.items.filter((home) => home.id !== homes.current?.id);
            setHomesList(filtered);
            setLoading(false);
        } else {
            toast.apiError(result, "Failed to load homes.");
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            getHomes();

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
    );

    useEffect(() => {
        getHomes();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homes.current?.id]);

    if (loading) {
        return <Loading />;
    }

    return (
        <View style={{ paddingTop: 15, flex: 1 }}>
            <Text
                size={"medium"}
                bold={true}
                color={"onBackground"}
                style={{ paddingHorizontal: 15, paddingBottom: 5 }}>
                Available Homes
            </Text>

            <FlatList
                data={homesList}
                keyExtractor={(item, index) => index.toString()}
                style={{ paddingHorizontal: 15, flex: 1 }}
                renderItem={({ item }) => <HomeListItem home={item} />}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <Text size={"medium"} color={"onBackground"}>
                        No other available homes.
                    </Text>
                }
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                contentContainerStyle={{ paddingVertical: 10, paddingBottom: 150 }}
                removeClippedSubviews={false}
            />
        </View>
    );
}

export default HomeList;
