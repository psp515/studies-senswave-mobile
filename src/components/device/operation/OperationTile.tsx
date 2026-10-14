import { View, Pressable } from "react-native";
import React from "react";
import Text from "@/components/common/Text";
import { useRouter } from "expo-router";
import { OperationType } from "@/types/DeviceTypes";
import { useTheme } from "@/contexts/ThemeProvider";
import { shadowStyles } from "@/styles/shadowStyles";

interface OperationTileProps {
    id: string;
    name: string;
    type: OperationType;
    disablePress?: boolean;
}

function OperationTile({ id, name, type, disablePress = false }: OperationTileProps) {
    const router = useRouter();
    const theme = useTheme();

    const icons = {
        Boolean: { letter: "B", colour: "#f5d258" },
        Number: { letter: "N", colour: "#5478d6" },
        Integer: { letter: "I", colour: "#2a59d4" },
        Text: { letter: "T", colour: "#64bd72" },
        HexColor: { letter: "HC", colour: "#71a832" },
        Options: { letter: "O", colour: "#32a887" },
    };

    const icon =
        type && icons[type as keyof typeof icons]
            ? icons[type as keyof typeof icons]
            : { letter: "?", colour: "#33363F40" };

    const onOperationClicked = () => {
        if (disablePress) {
            console.info("[OperationTile] Operation Clicked but disabled.");
            return;
        }

        console.info("[OperationTile] Operation Clicked.");
        router.push({
            pathname: "device/operation/details",
            params: {
                operationId: id,
            },
        });
    };

    return (
        <Pressable
            style={[
                {
                    height: 30,
                    flexDirection: "row",
                    alignItems: "center",
                },
            ]}
            onPress={onOperationClicked}>
            <View
                style={[
                    {
                        backgroundColor: icon.colour,
                        aspectRatio: 1,
                        height: 40,
                        marginRight: 10,
                        borderRadius: 10,
                        justifyContent: "center",
                        alignItems: "center",
                        ...shadowStyles.default,
                    },
                ]}>
                <Text size={"large"} color={"onPrimary"}>
                    {icon.letter}
                </Text>
            </View>
            <View
                style={{
                    backgroundColor: theme.current.colors.primary,
                    height: 40,
                    flex: 1,
                    borderRadius: 10,
                    justifyContent: "center",
                    paddingLeft: 10,
                    ...shadowStyles.default,
                }}>
                <Text size={"medium"} color={"onPrimary"}>
                    {name}
                </Text>
            </View>
        </Pressable>
    );
}

export default OperationTile;
