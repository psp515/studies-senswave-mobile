import { useEffect, useState } from "react";
import { FlatList, View, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/contexts/ApiProvider";
import { call, isNotFound } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import HomeSharingListItem from "./HomeSharingListItem";
import Button from "@/components/common/Button";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { HomeSharingDto } from "@/types/HomeTypes";

function HomeSharingList() {
    const api = useApi();
    const toast = useToast();
    const router = useRouter();
    const homes = useHomes();
    const [refresh, setRefresh] = useState<boolean>(false);
    const [homeSharings, setHomeSharings] = useState<HomeSharingDto[]>([]);
    const [reloadKey, setReloadKey] = useState(0);

    const onRefresh = async () => {
        setRefresh(true);

        if (refresh || !homes.current?.id) return;

        try {
            const homeId = homes.current.id;
            const result = await call(() => api.homeSharing.getSharings({ homeId }));

            if (result.isSuccess) {
                setHomeSharings(
                    result.data!.items.map((i) => ({
                        sharingId: i.sharingId,
                        friendEmail: i.friendEmail,
                        sharingType: i.sharingType,
                    })),
                );
            } else if (isNotFound(result)) {
                console.warn("[HomeSharingList] Home not shared.");
                setHomeSharings([]);
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load home sharings.");
        } finally {
            setRefresh(false);
        }
    };

    useEffect(() => {
        onRefresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homes.current?.id, reloadKey]);

    const handleItemRemoved = () => {
        setReloadKey((prevKey) => prevKey + 1); // Increment reloadKey to trigger useEffect
    };

    const handleShareHome = () => {
        router.push({
            pathname: "home/share",
            params: {
                id: homes.current?.id,
            },
        });
    };

    return (
        <View style={styles.containerHeight}>
            <FlatList
                data={homeSharings}
                renderItem={({ item }) => (
                    <View style={styles.itemContainer}>
                        <HomeSharingListItem
                            id={item.sharingId}
                            email={item.friendEmail}
                            type={item.sharingType}
                            onRemove={handleItemRemoved}
                        />
                    </View>
                )}
                keyExtractor={(item) => item.sharingId}
                contentContainerStyle={{
                    paddingBottom: 20,
                    padding: 5,
                    paddingTop: 0,
                }}
                ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                ListFooterComponent={
                    <View style={styles.footerContainer}>
                        <Button name="Invite" onPress={handleShareHome} loading={false} />
                    </View>
                }
                removeClippedSubviews={false}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} />}
            />
        </View>
    );
}

export default HomeSharingList;

const styles = StyleSheet.create({
    containerHeight: {
        height: " 100%",
    },
    itemContainer: {
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 8,
    },
    itemText: {
        fontSize: 16,
    },
    footerContainer: {
        marginTop: 10,
        alignItems: "center",
    },
    itemSeparator: {
        height: 10,
    },
});
