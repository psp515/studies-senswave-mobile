import Button from "@/components/common/Button";
import RoomForm, { RoomFormHandle } from "@/components/room/RoomForm";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";

function Add() {
    const router = useRouter();
    const homes = useHomes();
    const api = useApi();
    const toast = useToast();
    const formRef = useRef<RoomFormHandle>(null);
    const [loading, setLoading] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    const addClicked = async (values: any) => {
        setLoading(true);

        const result = await callSimple(() =>
            api.rooms.createRoom({ homeId: homes.current?.id as string, name: values.name }),
        );

        if (result.isSuccess) {
            toast.success("Room added successfully.");
            homes.refreshRooms();
            router.back();
        } else {
            toast.apiError(result, "Failed to add room.");
        }

        setLoading(false);
    };

    return (
        <View style={{ flex: 1 }}>
            <RoomForm
                ref={formRef}
                edit={false}
                onSubmit={addClicked}
                onValidChange={setIsFormValid}
            />

            <KeyboardStickyView style={{ paddingHorizontal: 15, paddingVertical: 12 }}>
                <Button
                    name="Create Room"
                    loading={loading}
                    onPress={() => formRef.current?.triggerSave()}
                    style={!isFormValid ? { opacity: 0.4 } : undefined}
                />
            </KeyboardStickyView>
        </View>
    );
}

export default Add;
