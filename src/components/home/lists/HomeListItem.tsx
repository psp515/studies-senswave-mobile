import React from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeProvider";
import Icon from "@/components/common/Icon";
import { useHomes } from "@/contexts/domain/HomeProvider";
import Text from "@/components/common/Text";
import { shadowStyles } from "@/styles/shadowStyles";
import { useToast } from "@/contexts/ToastProvider";
import { HomeListItemDto } from "@/types/HomeTypes";

interface HomeListItemProps {
    home: HomeListItemDto;
}

function HomeListItem({ home }: HomeListItemProps) {
    const theme = useTheme();
    const toast = useToast();
    const router = useRouter();
    const homes = useHomes();

    const homeClicked = () => {
        homes.setCurrent(home.id);
        router.back();
    };

    const settingsClicked = () => {
        toast.info("Switch to this home first before updating it.");
    };

    return (
        <Pressable
            onPress={homeClicked}
            onLongPress={settingsClicked}
            style={[
                shadowStyles.default,
                styles.currentHome,
                { backgroundColor: theme.current.colors.primary },
            ]}>
            <View style={styles.dataContainer}>
                <Icon icon={home.icon} size={26} color={"onPrimary"} />

                <View style={styles.textInDataContainer}>
                    <Text size={"large"} color={"onPrimary"}>
                        {home.name}
                    </Text>
                </View>

                <View style={styles.keyContainer}>
                    {home.isOwner && <Icon icon="key-outline" size={18} color="onPrimary" />}
                    {!home.isOwner && <Icon icon="people-outline" size={18} color="onPrimary" />}
                </View>
            </View>
        </Pressable>
    );
}

export default HomeListItem;

const styles = StyleSheet.create({
    currentHome: {
        borderRadius: 16,
        flexDirection: "row",
        padding: 10,
    },
    dataContainer: {
        marginLeft: 15,
        alignSelf: "center",
        flexDirection: "row",
    },
    textInDataContainer: {
        alignSelf: "center",
        marginLeft: 20,
        flex: 1,
    },
    text: {
        fontSize: 18,
    },
    keyContainer: {
        alignSelf: "center",
        justifyContent: "center",
        marginHorizontal: 10,
    },
});
