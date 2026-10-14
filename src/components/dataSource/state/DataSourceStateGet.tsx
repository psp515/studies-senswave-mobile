import { useEffect, useState } from "react";
import { View } from "react-native";
import React from "react";
import { useApi } from "@/contexts/ApiProvider";
import { call } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import Loading from "@/components/common/Loading";
import Text from "@/components/common/Text";
import DataSourceState from "./DataSourceState";

interface BrokerClientStateGetProperties {
    id: string;
}

function BrokerClientStateGet({ id }: BrokerClientStateGetProperties) {
    const api = useApi();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [state, setState] = useState<string | undefined>(undefined);

    const fetchBrokerClientState = async () => {
        setLoading(true);

        const result = await call(() => api.dataSources.getClientState({ brokerId: id }));

        if (result.isSuccess) {
            setState(result.data!.connectionStatus);
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        fetchBrokerClientState();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    return (
        <View style={{ width: "100%", alignItems: "center" }}>
            {loading ? (
                <>
                    <View style={{ height: 28 }}>
                        <Loading size={28} useBackgroundColor={false} />
                    </View>
                    <Text size={"medium"} color={"onPrimary"}>
                        Loading...
                    </Text>
                </>
            ) : (
                <DataSourceState connectionStatus={state} />
            )}
        </View>
    );
}

export default BrokerClientStateGet;
