import ConfirmDialog from "@/components/common/ConfirmDialog";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/contexts/ThemeProvider";
import Icon from "@/components/common/Icon";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useAutomationList } from "@/contexts/custom/AutomationListProvider";
import { useRouter } from "expo-router";
import { shadowStyles } from "@/styles/shadowStyles";
import Text from "@/components/common/Text";

const borderRadius = 12;

interface AutomationTileProps {
    automationId: string;
    automationIcon: string;
    automationName: string;
    automationIsEnabled?: boolean;

    isPressDisabled: boolean;
}

export default function AutomationTile({
    automationId,
    automationIcon,
    automationName,
    automationIsEnabled,
    isPressDisabled,
}: AutomationTileProps) {
    const theme = useTheme();
    const api = useApi();
    const toast = useToast();
    const automations = useAutomationList();
    const router = useRouter();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const deleteAutomation = async () => {
        console.log("[AutomationTile] Delete Automation trigger");
        const result = await callSimple(() => api.automations.deleteAutomation({ automationId }));

        if (result.isSuccess) {
            toast.success("Automation deleted successfully.");
            await automations.refresh();
        } else {
            toast.apiError(result);
        }
    };

    const onPress = () => {
        if (isPressDisabled) {
            console.log("[AutomationTile] Press is disabled");
            return;
        }

        console.log("[AutomationTile] Pressable was pressed!");
        router.push({
            pathname: "automation/details",
            params: { automationId: automationId },
        });
    };

    const longPress = () => {
        if (isPressDisabled) {
            console.log("[AutomationTile] Press is disabled");
            return;
        }

        console.log("[AutomationTile] Long Press Triggered");
        setShowDeleteDialog(true);
    };

    return (
        <>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Automation"
                content="This automation and all its conditions and results will be permanently deleted. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteAutomation();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <View
                style={[
                    styles.wrapper,
                    { backgroundColor: theme.current.colors.primary },
                    shadowStyles.default,
                ]}>
                <Pressable onPress={onPress} onLongPress={longPress} style={styles.presable}>
                    <View style={styles.iconContainer}>
                        <Icon icon={automationIcon} size={40} color={"onPrimary"} />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.textStyle} color={"onPrimary"} size={"large"}>
                            {automationName}
                        </Text>
                    </View>
                    <View
                        style={{
                            ...styles.enabledContainer,
                            backgroundColor: automationIsEnabled
                                ? theme.current.colors.success
                                : theme.current.colors.error,
                        }}></View>
                </Pressable>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        display: "flex",
        flexGrow: 1,
        height: 70,
        marginHorizontal: 10,
        marginTop: 10,
        flexDirection: "row",
        borderRadius: borderRadius,
    },
    presable: {
        flexGrow: 1,
        flexDirection: "row",
        borderRadius: borderRadius,
    },
    iconContainer: {
        height: "100%",
        width: "20%",
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        width: "75%",
        justifyContent: "center",
    },
    textStyle: {
        fontSize: 20,
        fontWeight: 300,
    },
    enabledContainer: {
        width: "5%",
        borderTopRightRadius: borderRadius,
        borderBottomRightRadius: borderRadius,
    },
});
