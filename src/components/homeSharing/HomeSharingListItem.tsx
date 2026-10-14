import ConfirmDialog from "@/components/common/ConfirmDialog";
import ImageButton from "@/components/common/ImageButton";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useTheme } from "@/contexts/ThemeProvider";
import { useToast } from "@/contexts/ToastProvider";
import { shadowStyles } from "@/styles/shadowStyles";
import { HomeRolesToName } from "@/types/HomeTypes";
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import Text from "../common/Text";

interface HomeSharingListItemProps {
    id: string;
    email: string;
    type: string;
    onRemove: () => void;
}

function HomeSharingListItem({ id, email, type, onRemove }: HomeSharingListItemProps) {
    const theme = useTheme();
    const api = useApi();
    const toast = useToast();
    const [showRemoveDialog, setShowRemoveDialog] = useState(false);

    const removeSharing = async () => {
        try {
            const result = await callSimple(() =>
                api.homeSharing.deleteSharing({ homeSharingId: id }),
            );
            if (result.isSuccess) {
                toast.success("Home sharing removed.");
                onRemove();
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error("Failed to remove sharing", error);
            toast.error("Failed to remove home sharing.");
        }
    };

    const removalAlert = () => {
        setShowRemoveDialog(true);
    };

    return (
        <View style={styles.container}>
            <ConfirmDialog
                visible={showRemoveDialog}
                title="Remove Access"
                content={`${email} will lose access to this home and all its devices. This action cannot be undone.`}
                onConfirm={() => {
                    setShowRemoveDialog(false);
                    removeSharing();
                }}
                onCancel={() => setShowRemoveDialog(false)}
            />
            <View
                style={[
                    styles.itemContainer,
                    { backgroundColor: theme.current.colors.primary },
                    shadowStyles.default,
                ]}>
                <Text size={"medium"} color={"onPrimary"} bold>
                    {email}
                </Text>
                <Text size={"small"} color={"onPrimary"}>
                    {HomeRolesToName.get(type) ?? "Role not found"}
                </Text>
            </View>
            <View style={styles.iconContainer}>
                <ImageButton
                    onPress={removalAlert}
                    icon={"person-remove-outline"}
                    size={24}
                    style={styles.buttonStyles}
                />
            </View>
        </View>
    );
}

export default HomeSharingListItem;

const styles = StyleSheet.create({
    buttonStyles: {
        height: "100%",
        alignContent: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },
    icon: {
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
        paddingHorizontal: 12,
    },
    container: {
        width: "100%",
        flexDirection: "row",
        display: "flex",
        flex: 1,
    },
    itemContainer: {
        alignItems: "flex-start",
        borderRadius: 8,
        padding: 8,
        paddingHorizontal: 12,
        flex: 1,
    },
    textAndIconContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    },
    iconContainer: {
        marginLeft: 10,
    },
    emailText: {
        fontSize: 18,
        fontWeight: "bold",
    },
    typeText: {
        fontSize: 14,
    },
});
