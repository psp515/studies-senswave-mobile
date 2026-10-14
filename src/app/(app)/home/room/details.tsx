import ConfirmDialog from "@/components/common/ConfirmDialog";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import RoomForm, { RoomFormHandle } from "@/components/room/RoomForm";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { call, callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { Room } from "@/types/HomeTypes";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

function Details() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const homes = useHomes();
    const api = useApi();
    const toast = useToast();
    const formRef = useRef<RoomFormHandle>(null);

    const [loading, setLoading] = useState(false);
    const [room, setRoom] = useState<Room | undefined>(undefined);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const editClicked = async (values: any) => {
        setLoading(true);
        const result = await callSimple(() =>
            api.rooms.updateRoom({
                homeId: homes.current?.id as string,
                roomId: id as string,
                name: values.name,
            }),
        );

        if (result.isSuccess) {
            toast.success("Room updated successfully.");
            homes.refreshRooms();
            router.back();
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    const deleteRoom = async () => {
        const result = await callSimple(() =>
            api.rooms.deleteRoom({ homeId: homes.current?.id as string, roomId: id as string }),
        );

        if (result.isSuccess) {
            toast.success("Room removed successfully.");
            homes.refreshRooms();
            router.back();
        } else {
            toast.apiError(result, "Failed to remove room.");
        }
    };

    const deleteAlert = () => {
        setShowDeleteDialog(true);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const result = await call(() =>
                api.rooms.getRoom({ homeId: homes.current?.id as string, roomId: id as string }),
            );

            if (result.isSuccess) {
                setRoom({ id: result.data!.id, name: result.data!.name });
            } else {
                toast.apiError(result);
            }

            setLoading(false);
        };

        loadData();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    if (loading) return <Loading activityColor="textOnBackground" />;

    const fabActions: FABAction[] = [
        ...(isFormDirty
            ? [
                  {
                      icon: "checkmark-outline",
                      label: "Save",
                      onPress: () => formRef.current?.triggerSave(),
                  },
                  {
                      icon: "refresh-outline",
                      label: "Restore",
                      onPress: () => formRef.current?.triggerReset(),
                  },
              ]
            : []),
        { icon: "trash-outline", label: "Delete Room", onPress: deleteAlert },
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Room"
                content="The room will be permanently deleted. Devices assigned to it will become unassigned. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteRoom();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <RoomForm
                ref={formRef}
                initName={room?.name}
                onSubmit={editClicked}
                edit={true}
                onDirtyChange={setIsFormDirty}
            />

            <FAB actions={fabActions} forceExpanded={isFormDirty} />
        </View>
    );
}

export default Details;
