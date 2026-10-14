import React, { useState } from "react";
import { Pressable } from "react-native";
import Text from "@/components/common/Text";
import Loading from "@/components/common/Loading";
import { useTheme } from "@/contexts/ThemeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { toProtoValue } from "@/api/json";
import { CalculatedWidget } from "../../dashboards/DashboardView";
import { useToast } from "@/contexts/ToastProvider";
import { shadowStyles } from "@/styles/shadowStyles";

interface ButtonWidgetProps {
    operations: () => void;
    widget: CalculatedWidget;
    disabled: boolean;
}

export default function ButtonWidget({ widget, operations, disabled }: ButtonWidgetProps) {
    const api = useApi();
    const theme = useTheme();
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    const action = async () => {
        if (loading) {
            console.warn("[Button Widget] Action already in progress.");
            return;
        }

        setLoading(true);

        const result = await callSimple(() =>
            api.widgets.action({ widgetId: widget.id, value: toProtoValue("") }),
        );

        if (result.isSuccess) {
            console.info("[Button Widget] Action sent successfully.");
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    return (
        <Pressable
            style={({ pressed }) => [
                {
                    backgroundColor: pressed
                        ? theme.current.colors.secondary
                        : theme.current.colors.primary,

                    borderRadius: 8,
                    alignContent: "center",
                    width: "100%",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    ...shadowStyles.default,
                },
            ]}
            disabled={disabled}
            onPress={action}
            onLongPress={operations}>
            {loading ? (
                <Loading size={32} useBackgroundColor={false} />
            ) : (
                <Text size={"medium"} color={"onPrimary"}>
                    {widget?.name}
                </Text>
            )}
        </Pressable>
    );
}
