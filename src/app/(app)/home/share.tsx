import { useApi } from "@/contexts/ApiProvider";
import { call } from "@/api/call";
import { useTheme } from "@/contexts/ThemeProvider";
import { useToast } from "@/contexts/ToastProvider";
import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import Loading from "@/components/common/Loading";
import { View } from "react-native";
import Text from "@/components/common/Text";
import { shadowStyles } from "@/styles/shadowStyles";
import ImageButton from "@/components/common/ImageButton";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { HomeRolesToName } from "@/types/HomeTypes";
import Dropdown, { Option } from "@/components/common/Dropdown";
import { useHomes } from "@/contexts/domain/HomeProvider";
import UserNote from "@/components/common/UserNote";

const roleOptions: Option[] = [
    { name: HomeRolesToName.get("Display")!, value: "Display" },
    { name: HomeRolesToName.get("Manage")!, value: "Manage" },
];

function ShareHomePage() {
    const api = useApi();
    const theme = useTheme();
    const toast = useToast();
    const home = useHomes();
    const [loading, setLoading] = useState<boolean>(false);

    const [password, setPassword] = useState<string>("");

    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [role, setRole] = useState<string>("Display");

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text);
        toast.success("Code copied to clipboard.");
    };

    const submitClicked = async () => {
        try {
            setLoading(true);

            const result = await call(() =>
                api.homeSharing.createSharing({
                    homeId: home.current!.id,
                    friendEmail: email,
                    sharingType: role,
                }),
            );

            if (result.isSuccess) {
                toast.success("Home sharing password generated.");

                setPassword(result.data!.password);
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error("Failed to share home", error);
            toast.error("Failed to share home.");
        } finally {
            setLoading(false);
        }
    };

    const validateForm = (): boolean => {
        if (email === "" && password === "") {
            setEmailError("");
            return false;
        }

        if (!email) {
            setEmailError("Email is required.");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            setEmailError("Email is not valid.");
            return false;
        }

        setEmailError("");

        return true;
    };

    useEffect(() => {
        validateForm();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email, password]);

    if (loading) {
        return <Loading />;
    }

    return (
        <View style={{ flex: 1, padding: 15 }}>
            <UserNote
                text="When sharing access to your home, advise all users that the app displays device states on all pages for information purposes only. These values may differ from the real device state and should not be treated as confirmed or guaranteed."
                numberOfLines={10}
                style={{ paddingHorizontal: 0, paddingBottom: 15 }}
            />

            {password && (
                <View style={{ paddingHorizontal: 0 }}>
                    <Text size={"medium"} color={"onBackground"}>
                        {" "}
                        Password{" "}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 5 }}>
                        <View
                            style={[
                                {
                                    backgroundColor: theme.current.colors.primary,
                                    flex: 1,
                                    borderRadius: 12,
                                    padding: 10,
                                    marginRight: 15,
                                    justifyContent: "center",
                                },
                                shadowStyles.default,
                            ]}>
                            <Text selectable size={"medium"} color={"onBackground"}>
                                {password}
                            </Text>
                        </View>

                        <ImageButton
                            size={26}
                            icon="copy-outline"
                            onPress={() => copyToClipboard(password)}
                        />
                    </View>

                    <View style={{ paddingTop: 15, alignItems: "center" }}>
                        <Text size={"medium"} color={"onBackground"}>
                            Share this password with your friend!
                        </Text>
                    </View>
                </View>
            )}

            <View style={{ flex: 1 }}>
                <Input
                    error={emailError}
                    value={email}
                    setValue={setEmail}
                    title="Email"
                    placeholder="friend@example.com"
                />

                <Dropdown
                    selectedValue={role}
                    title="Role"
                    onSelected={(role) => {
                        console.debug("[Share Page] Role changed to:", role);
                        setRole(role);
                    }}
                    options={roleOptions}
                    style={{ marginTop: 0 }}
                />

                <Button
                    style={{ marginTop: 20 }}
                    name="Share Home"
                    onPress={submitClicked}
                    type="alternative"
                    loading={loading}
                />
            </View>
        </View>
    );
}

export default ShareHomePage;
