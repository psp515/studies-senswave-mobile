import ImageButton from "@/components/common/ImageButton";
import { useConfiguration } from "@/contexts/ConfigurationProvider";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useApi } from "@/contexts/ApiProvider";
import HorizontalSelector from "@/components/common/HorizontalSelector";
import Text from "@/components/common/Text";
import { parseTransportMode, TransportModes } from "@/api/transport/TransportMode";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { useToast } from "@/contexts/ToastProvider";

const Server: React.FC = () => {
    const router = useRouter();
    const toast = useToast();
    const configuration = useConfiguration();
    const api = useApi();

    const [url, setUrl] = React.useState<string>("");

    const handleBack = () => {
        console.debug("Back clicked");
        router.back();
    };

    const setOverrideUrl = () => {
        configuration.overrideUrl(url);

        toast.success("Set override URL to: " + url);
    };

    const resetToDefault = () => {
        configuration.overrideUrl("");
        configuration.overrideTransportMode(null);

        const baseUrl = configuration.getBaseUrl().toString();
        setUrl(baseUrl);

        toast.success("Reset to default URL: " + baseUrl);
    };

    useEffect(() => {
        const baseUrl = configuration.getBaseUrl().toString();
        setUrl(baseUrl);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <View
                style={{
                    height: "15%",
                    width: "100%",
                    justifyContent: "center",
                    paddingTop: 30,
                    paddingHorizontal: 15,
                }}>
                <ImageButton onPress={handleBack} />
            </View>

            <View
                style={{
                    flex: 1,
                    justifyContent: "flex-start",
                    alignItems: "center",
                    width: "100%",
                    paddingHorizontal: 15,
                }}>
                <View style={{ width: "100%", marginBottom: 20 }}>
                    <Input
                        value={url}
                        title="Server URL"
                        setValue={setUrl}
                        error={""}
                        placeholder={""}
                    />

                    {configuration.isDevelopment() && (
                        <>
                            <HorizontalSelector
                                options={[...TransportModes]}
                                selected={configuration.transportMode}
                                onSelect={(o) =>
                                    configuration.overrideTransportMode(parseTransportMode(o))
                                }
                                margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
                            />
                            {api.requestedTransportMode !== api.transportMode && (
                                <Text size="small">
                                    {`${api.requestedTransportMode} is not available on this build, using ${api.transportMode}.`}
                                </Text>
                            )}
                        </>
                    )}

                    <Button
                        name={"Save"}
                        loading={false}
                        onPress={setOverrideUrl}
                        style={{ marginBottom: 10, marginTop: 10 }}
                    />
                    <Button
                        type="alternative"
                        name={"Reset"}
                        loading={false}
                        onPress={resetToDefault}
                    />
                </View>
            </View>
        </View>
    );
};

export default Server;
