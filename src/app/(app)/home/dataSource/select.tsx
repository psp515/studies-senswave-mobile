import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useToast } from "@/contexts/ToastProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useHomes } from "@/contexts/domain/HomeProvider";
import Loading from "@/components/common/Loading";
import ImageButton from "@/components/common/ImageButton";
import DataSourceList from "@/components/dataSource/DataSourceList";

function SelectHomeDataSource() {
    const toast = useToast();
    const router = useRouter();
    const api = useApi();
    const homes = useHomes();
    const [loading, setLoading] = useState(false);

    const onAddDataSource = () => {
        router.push("dataSource/add");
    };

    if (loading) {
        return <Loading />;
    }

    const onDataSourceSelected = async (id: string) => {
        if (loading) {
            return;
        }

        try {
            setLoading(true);

            const result = await callSimple(
                () =>
                    api.homes.setHomeDataSource({
                        homeId: homes.current?.id as string,
                        brokerId: id,
                    }),
                "Failed to link data source: only one broker per home is allowed.",
            );

            if (result.isSuccess) {
                toast.success("Data source linked to home.");
                homes.refreshCurrent();
                router.back();
            } else {
                console.error(
                    `Failed to link data source to home. (One Broker per Home). ${result.errorMessage}`,
                );
                toast.apiError(result);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.container}>
                <DataSourceList onListItemSelected={onDataSourceSelected} />
            </View>

            <View
                style={{
                    position: "absolute",
                    bottom: 0,
                    paddingHorizontal: 15,
                    marginBottom: 15,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    width: "100%",
                    flexDirection: "row",
                    gap: 15,
                }}>
                <ImageButton icon="add-outline" size={40} onPress={onAddDataSource} />
            </View>
        </View>
    );
}

export default SelectHomeDataSource;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 0,
    },
    buttonContainer: {
        position: "absolute",
        bottom: 30,
        right: 10,
        justifyContent: "flex-end",
        alignItems: "center",
    },
});
