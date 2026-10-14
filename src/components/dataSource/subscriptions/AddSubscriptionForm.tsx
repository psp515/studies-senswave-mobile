import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useToast } from "@/contexts/ToastProvider";
import { keyboardOffset } from "@/styles/defaultStyles";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import React, { FC, useState } from "react";

interface AddSubscriptionFormProps {
    brokerId: string;
}

const AddSubscriptionForm: FC<AddSubscriptionFormProps> = ({ brokerId }) => {
    const api = useApi();
    const toast = useToast();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState("");
    const [topicError, setTopicError] = useState("");

    const validateTopic = (value: string): boolean => {
        if (value.trim() === "") {
            setTopicError("Topic is required.");
            return false;
        }
        if (value.length > 256) {
            setTopicError("Topic is too long.");
            return false;
        }
        setTopicError("");
        return true;
    };

    const onSubmit = async () => {
        if (!validateTopic(topic)) return;

        setLoading(true);
        try {
            const result = await callSimple(() =>
                api.dataSources.createSubscribtion({ brokerId, topic: topic.trim() }),
            );
            if (result.isSuccess) {
                toast.success("Subscription added.");
                router.back();
            } else {
                toast.apiError(result);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAwareScrollView
            bottomOffset={keyboardOffset}
            contentContainerStyle={{ paddingHorizontal: 15, paddingTop: 10, paddingBottom: 90 }}>
            <Input
                title="Topic"
                placeholder="home/sensors/temperature"
                value={topic}
                setValue={setTopic}
                error={topicError}
                trim={true}
            />

            <Button
                style={{ marginTop: 15 }}
                name="Create Subscription"
                onPress={onSubmit}
                loading={loading}
            />
        </KeyboardAwareScrollView>
    );
};

export default AddSubscriptionForm;
