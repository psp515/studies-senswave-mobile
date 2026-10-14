import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import ImageButton from "../common/ImageButton";
import Input from "../common/Input";
import IconSelector from "../common/IconSelector";
import DeviceTile from "./tile/DeviceTile";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { DevicePresenceType } from "@/types/DeviceTypes";
import Dropdown, { Option } from "../common/Dropdown";
import OperationSelector from "./operation/OperationSelector";
import RoomSelector from "../room/RoomSelector";
import { useToast } from "@/contexts/ToastProvider";
import Divider from "../common/Divider";
import Expander from "../common/Expander";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { keyboardOffset } from "@/styles/defaultStyles";

const numColumns = 2;
const screenWidth = Dimensions.get("window").width;
const edgePadding = 15;
const innerSpacing = 20;
const itemWidth = (screenWidth - edgePadding * 2 - innerSpacing * (numColumns - 1)) / numColumns;

const DefaultIcons = [
    "bulb-outline",
    "thermometer-outline",
    "lock-closed-outline",
    "camera-outline",
    "power-outline",
    "hardware-chip-outline",
    "wifi-outline",
    "phone-portrait-outline",
    "laptop-outline",
    "desktop-outline",
    "tv-outline",
    "server-outline",
    "battery-charging-outline",
    "alarm-outline",
    "mic-outline",
    "finger-print-outline",
    "water-outline",
    "leaf-outline",
    "snow-outline",
    "flame-outline",
] as string[];

const DefaultDeviceIcon: string = "bulb-outline";

const TileTypeOptions: Option[] = [
    { name: "Default", value: "Default" },
    { name: "Switch", value: "Switch" },
    { name: "Display", value: "Display" },
];

const PresenceTypeOptions: Option[] = [
    { value: "Default", name: "No presence" },
    { value: "BooleanOperation", name: "Boolean operation" },
];

export interface DeviceFormRef {
    save: () => void;
    reset: () => void;
}

interface DeviceFormProps {
    deviceId?: string;
    initName?: string;
    initIcon?: string;
    initRoomId?: string;

    initTileType?: string;
    initTileOperationId?: string;
    initTileDisplayableOperationId?: string;
    initTileUnit?: string;

    initPresenceType?: string;
    initPresenceOperationId?: string;

    onSubmit: (values: any) => Promise<void>;
    onHasChanges?: (hasChanges: boolean) => void;
    edit?: boolean;
}

const baseRooms: Option[] = [{ value: "None", name: "None" }];

const DeviceForm = forwardRef<DeviceFormRef, DeviceFormProps>(function DeviceForm(
    {
        deviceId,
        initName,
        initIcon,
        initRoomId,

        initTileType,
        initTileOperationId,
        initTileDisplayableOperationId,
        initTileUnit,

        initPresenceType,
        initPresenceOperationId,

        onSubmit,
        onHasChanges,
        edit = false,
    }: DeviceFormProps,
    ref,
) {
    const homes = useHomes();
    const toast = useToast();

    console.log("DeviceForm initialized with: ");
    console.warn(initPresenceType, initPresenceOperationId);

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState<string>(initName ?? "");
    const [nameError, setNameError] = useState<string>("");
    const [icon, setIcon] = useState(initIcon ?? DefaultDeviceIcon);
    const [roomId, setRoomId] = useState<string>(initRoomId ?? "None");
    const [roomOptionsList, setRoomOptionsList] = useState<Option[]>(baseRooms);

    const [tileType, setTileType] = useState<string>(initTileType ?? "Default");
    const [tileOperationId, setTileOperationId] = useState<string>(initTileOperationId ?? "None");
    const [tileDisplayableOperationId, setTileDisplayableOperationId] = useState<string>(
        initTileDisplayableOperationId ?? "None",
    );
    const [tileUnit, setTileUnit] = useState<string>(initTileUnit ?? "");

    const [presenceType, setPresenceType] = useState<string>(initPresenceType ?? "Default");
    const [presenceOperationId, setPresenceOperationId] = useState<string>(
        initPresenceOperationId ?? "None",
    );

    const operationSelected = (value: string) => {
        setTileOperationId(value);
    };

    const displayableOperationSelected = (value: string) => {
        setTileDisplayableOperationId(value);
    };

    const tileTypeSelected = (value: string) => {
        setTileType(value);
    };

    const buttonClicked = async () => {
        if (loading) {
            console.info("[DeviceForm] Form is processing");
            return;
        }

        if (!validateForm()) {
            console.info("[DeviceForm] Form is invalid");
            return;
        }

        setLoading(true);

        let values: any = {};

        if (!edit) {
            values = {
                homeId: homes.current?.id,
                roomId: roomId === "None" ? null : roomId,
                name,
                icon,
            };
        } else {
            if (name !== initName) values.name = name;

            if (icon !== initIcon) values.icon = icon;

            if (roomId !== initRoomId) values.roomId = roomId === "None" ? null : roomId;

            if (tileType !== initTileType) values.type = tileType;

            if (tileOperationId !== initTileOperationId && tileType === "Switch") {
                values.type = tileType;
                values.operationId = tileOperationId === "None" ? null : tileOperationId;
            }

            if (tileType === "Display") {
                if (tileDisplayableOperationId !== initTileDisplayableOperationId) {
                    values.type = tileType;
                    values.displayableOperationId =
                        tileDisplayableOperationId === "None" ? null : tileDisplayableOperationId;
                }
                if (tileUnit !== (initTileUnit ?? "")) {
                    values.type = tileType;
                    values.configuration = { unit: tileUnit };
                }
            }

            values.presenceType = presenceType;
            if (
                presenceType === "BooleanOperation" &&
                presenceOperationId !== "None" &&
                presenceOperationId !== ""
            ) {
                values.presenceOperationId = presenceOperationId;
            }
        }

        console.debug("[DeviceForm] Submitting form with values: ", values);
        await onSubmit(values);

        setLoading(false);
    };

    const validateForm = (): boolean => {
        let valid: boolean = true;

        if (name === "") {
            valid = false;
            setNameError("");
        } else if (name.length > 64) {
            valid = false;
            setNameError("Name is too long.");
        } else if (name.length < 3) {
            valid = false;
            setNameError("Name is too short.");
        } else {
            setNameError("");
        }

        if (tileType === "Switch" && (tileOperationId === "None" || tileOperationId === "")) {
            valid = false;
            toast.info("Select operation for switch tile.");
        }

        if (
            tileType === "Display" &&
            (tileDisplayableOperationId === "None" || tileDisplayableOperationId === "")
        ) {
            valid = false;
            toast.info("Select operation for display tile.");
        }

        return valid;
    };

    const isButtonVisible = () => {
        return (
            name !== (initName ?? "") ||
            icon !== (initIcon ?? DefaultDeviceIcon) ||
            roomId !== (initRoomId ?? "None") ||
            tileType !== (initTileType ?? "Default") ||
            tileOperationId !== (initTileOperationId ?? "None") ||
            tileDisplayableOperationId !== (initTileDisplayableOperationId ?? "None") ||
            tileUnit !== (initTileUnit ?? "") ||
            presenceType !== (initPresenceType ?? "Default") ||
            presenceOperationId !== (initPresenceOperationId ?? "None") ||
            !edit
        );
    };

    const reset = () => {
        setName(initName ?? "");
        setIcon(initIcon ?? DefaultDeviceIcon);
        setRoomId(initRoomId ?? "None");
        setTileType(initTileType ?? "Default");
        setTileOperationId(initTileOperationId ?? "None");
        setTileDisplayableOperationId(initTileDisplayableOperationId ?? "None");
        setTileUnit(initTileUnit ?? "");
        setPresenceType(initPresenceType ?? "Default");
        setPresenceOperationId(initPresenceOperationId ?? "None");
    };

    useImperativeHandle(ref, () => ({ save: buttonClicked, reset }));

    useEffect(() => {
        onHasChanges?.(isButtonVisible());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        name,
        icon,
        roomId,
        tileType,
        tileOperationId,
        tileDisplayableOperationId,
        tileUnit,
        presenceType,
        presenceOperationId,
    ]);

    useEffect(() => {
        const rooms = homes.current?.rooms;

        const optionRooms = [
            ...(rooms?.map((room) => ({ value: room.id, name: room.name })) ?? []),
            ...baseRooms,
        ];

        setRoomOptionsList(optionRooms);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onRoomSelected = (roomId: string) => {
        setRoomId(roomId);
    };

    useEffect(() => {
        if (name === "") {
            setNameError("");
        } else if (name.length > 64) {
            setNameError("Name is too long.");
        } else if (name.length < 3) {
            setNameError("Name is too short.");
        } else {
            setNameError("");
        }
    }, [name]);

    // TODO: Presence should be disabled by default -> check incoming json or informations because it is enabled.

    return (
        <View style={styles.container}>
            <View style={styles.displayContainer}>
                <DeviceTile
                    device={{
                        id: "",
                        name: name,
                        icon: icon,
                        roomId: roomId === "None" ? undefined : roomId,
                        tile: {
                            type: tileType,
                            operationId: tileOperationId,
                            displayableOperationId: tileDisplayableOperationId,
                            value: undefined,
                            configuration: tileType === "Display" ? { unit: tileUnit } : undefined,
                        },
                        presence:
                            presenceType !== "Default"
                                ? { type: presenceType as DevicePresenceType, value: null }
                                : undefined,
                        createdAtUtc: new Date().toISOString(),
                        updatedAtUtc: new Date().toISOString(),
                    }}
                    disablePress={true}
                />
            </View>

            <Divider style={{ paddingHorizontal: 15 }} />

            <KeyboardAwareScrollView
                bottomOffset={keyboardOffset}
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 80 }}>
                <Input
                    error={nameError}
                    value={name}
                    title="Name"
                    placeholder="Your device name"
                    setValue={setName}
                />

                <IconSelector defaultIcon={icon} iconList={DefaultIcons} onIconSelected={setIcon} />

                {edit ? (
                    <RoomSelector initialRoomId={roomId} onSelected={onRoomSelected} />
                ) : (
                    <Dropdown
                        selectedValue={roomId}
                        title={"Room"}
                        options={roomOptionsList}
                        onSelected={onRoomSelected}
                    />
                )}

                {edit && (
                    <Expander title="Tile" padding={{ paddingTop: 10 }}>
                        <Dropdown
                            title={"Tile Type"}
                            options={TileTypeOptions}
                            selectedValue={tileType}
                            onSelected={tileTypeSelected}
                        />

                        {tileType === "Switch" && (
                            <View style={{ paddingTop: 10 }}>
                                <OperationSelector
                                    initialOperationId={tileOperationId}
                                    deviceId={deviceId!}
                                    filterTypes={["Boolean"]}
                                    onSelected={operationSelected}
                                />
                            </View>
                        )}

                        {tileType === "Display" && (
                            <View style={{ paddingTop: 10 }}>
                                <OperationSelector
                                    initialOperationId={tileDisplayableOperationId}
                                    deviceId={deviceId!}
                                    filterTypes={["Number", "Integer"]}
                                    onSelected={displayableOperationSelected}
                                />
                                {tileDisplayableOperationId !== "None" &&
                                    tileDisplayableOperationId !== "" && (
                                        <View style={{ paddingTop: 10, width: "50%" }}>
                                            <Input
                                                value={tileUnit}
                                                title="Unit"
                                                placeholder="e.g. °C"
                                                setValue={setTileUnit}
                                                error=""
                                            />
                                        </View>
                                    )}
                            </View>
                        )}
                    </Expander>
                )}

                {edit && (
                    <Expander title="Presence" padding={{ paddingTop: 10 }}>
                        <Dropdown
                            title={"Presence Type"}
                            options={PresenceTypeOptions}
                            selectedValue={presenceType}
                            onSelected={setPresenceType}
                        />
                        {presenceType === "BooleanOperation" && (
                            <View style={{ paddingTop: 10 }}>
                                <OperationSelector
                                    deviceId={deviceId!}
                                    initialOperationId={presenceOperationId}
                                    filterTypes={["Boolean"]}
                                    onSelected={setPresenceOperationId}
                                />
                            </View>
                        )}
                    </Expander>
                )}
            </KeyboardAwareScrollView>

            {!edit && isButtonVisible() && (
                <View style={styles.buttonContainer}>
                    <ImageButton
                        size={40}
                        icon="add-outline"
                        loading={loading}
                        onPress={buttonClicked}
                    />
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 0,
        margin: 0,
        marginTop: 0,
    },
    displayContainer: {
        justifyContent: "center",
        alignItems: "center",
        alignContent: "center",
        borderRadius: 8,
        minHeight: 124,
        maxHeight: itemWidth,
    },
    scrollContainer: {
        paddingHorizontal: 15,
        margin: 0,
    },
    buttonContainer: {
        position: "absolute",
        bottom: 0,
        right: 15,
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: 15,
    },
});

export default DeviceForm;
