import Loading from "@/components/common/Loading";
import DataSourceTile from "@/components/dataSource/tile/DataSourceTile";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import { isoFromTimestamp } from "@/api/json";
import type { GetBrokersResponse } from "@/api/gen/datasources/v1/datasources_pb";
import { useToast } from "@/contexts/ToastProvider";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import Text from "@/components/common/Text";
import { useFocusEffect } from "expo-router";

export type DataSource = {
    id: string;
    name: string;
    server: string;
    createdAt: string;
    updatedAt: string;
};

const toDataSources = (r: GetBrokersResponse): DataSource[] =>
    r.items.map((i) => ({
        id: i.id,
        name: i.name,
        server: i.server,
        createdAt: isoFromTimestamp(i.createdAt),
        updatedAt: isoFromTimestamp(i.updatedAt),
    }));

interface DataSourceListInterface {
    onListItemSelected?: (id: string) => void;
}

function DataSourceList({ onListItemSelected }: DataSourceListInterface) {
    const api = useApi();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dataSources, setDataSources] = useState<DataSource[]>([]);

    const fetchBrokers = () =>
        call(
            () => api.dataSources.getBrokers({ page: 0, size: 0 }),
            "Failed to load data sources.",
        );

    const onRefresh = async () => {
        setRefreshing(true);
        const result = await fetchBrokers();

        if (result.isSuccess) {
            setDataSources(toDataSources(result.data!));
        } else if (isNotFound(result)) {
            setDataSources([]);
        } else {
            toast.apiError(result);
        }
        setRefreshing(false);
    };

    const getDataSources = async () => {
        setLoading(true);
        const result = await fetchBrokers();

        if (result.isSuccess) {
            setDataSources(toDataSources(result.data!));
        } else if (isNotFound(result)) {
            setDataSources([]);
            toast.info("Create your first data source.");
        } else {
            toast.apiError(result);
        }
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            getDataSources();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
    );

    useEffect(() => {
        getDataSources();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return <Loading />;
    }

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <FlatList
                data={dataSources}
                keyExtractor={(item, index) => index.toString()}
                style={{ paddingHorizontal: 15, flex: 1 }}
                renderItem={({ item }) => (
                    <DataSourceTile
                        id={item.id}
                        name={item.name}
                        server={item.server}
                        onClicked={onListItemSelected}
                    />
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <Text size={"medium"} color={"onBackground"}>
                        No data sources found.
                    </Text>
                }
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                contentContainerStyle={{ paddingVertical: 10, paddingBottom: 90 }}
                removeClippedSubviews={false}
            />
        </View>
    );
}

export default DataSourceList;
