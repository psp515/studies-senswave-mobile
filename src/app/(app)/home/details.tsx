import ButtonWithTextAndImage from "@/components/common/ButtonWithTextAndImage";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Expander from "@/components/common/Expander";
import FAB, { FABAction } from "@/components/common/FAB";
import Loading from "@/components/common/Loading";
import DataSourceTile from "@/components/dataSource/tile/DataSourceTile";
import HomeForm, { HomeFormHandle } from "@/components/home/HomeForm";
import HomeSharingList from "@/components/homeSharing/HomeSharingList";
import { useHomes } from "@/contexts/domain/HomeProvider";
import { useApi } from "@/contexts/ApiProvider";
import { callSimple } from "@/api/call";
import { useHttpClient } from "@/contexts/HttpClientProvider";
import { useToast } from "@/contexts/ToastProvider";
import { DataSourceDto } from "@/types/DataSourcesTypes";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

function DetailsPage() {
    const router = useRouter();
    const toast = useToast();
    const api = useApi();
    const httpClient = useHttpClient();
    const homes = useHomes();
    const [loading, setLoading] = useState(false);
    const [unlinkLoading, setUnlinkLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showLeaveDialog, setShowLeaveDialog] = useState(false);
    const formRef = useRef<HomeFormHandle>(null);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [dataSource, setDataSource] = useState<DataSourceDto | undefined>(undefined);

    const editClicked = async (values: any) => {
        setLoading(true);

        const result = await callSimple(() =>
            api.homes.updateHome({
                homeId: homes.current?.id as string,
                name: values.name ?? "",
                icon: values.icon ?? "",
                latitude: values.latitude,
                longitude: values.longitude,
            }),
        );

        if (result.isSuccess) {
            toast.success("Home updated successfully.");
            await homes.setCurrent(homes.current?.id as string);
        } else {
            toast.apiError(result);
        }

        setLoading(false);
    };

    const deleteHome = async () => {
        const result = await callSimple(() => api.homes.deleteHome({ homeId: homes.current!.id }));

        if (result.isSuccess) {
            toast.success("Home removed successfully.");
            await homes.initializeCurrentHome();
            router.replace("/");
        } else {
            toast.apiError(result);
        }
    };

    const deleteClicked = () => {
        setShowDeleteDialog(true);
    };

    const leaveHome = async () => {
        try {
            setLoading(true);
            const result = await callSimple(() =>
                api.homeSharing.leaveSharing({ homeId: homes.current!.id }),
            );

            if (result.isSuccess) {
                toast.success("Left home successfully.");
                await homes.initializeCurrentHome();
                router.back();
            } else {
                toast.apiError(result);
            }
        } finally {
            setLoading(false);
        }
    };

    const leaveHomeAlert = () => {
        setShowLeaveDialog(true);
    };

    const loadDataSource = async () => {
        setLoading(true);

        const response = await httpClient.get(
            "v1/datasources/brokers/" + homes.current?.dataSource?.id,
        );

        if (response.isSuccess) {
            const content = (await response.response?.json()) as DataSourceDto;
            setDataSource(content);
        } else {
            toast.error("Failed to load home data source.");
        }

        setLoading(false);
    };

    const onSelectDataSource = () => {
        router.push({ pathname: "home/dataSource/select" });
    };

    const unlinkDataSource = async () => {
        if (unlinkLoading || loading) {
            return;
        }

        try {
            setUnlinkLoading(true);

            const result = await callSimple(() =>
                api.homes.deleteHomeDataSource({ homeId: homes.current?.id as string }),
            );

            if (result.isSuccess) {
                await homes.refreshCurrent();
                setDataSource(undefined);
                toast.success("Unlinked data source from home.");
            } else {
                toast.apiError(result);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setUnlinkLoading(false);
        }
    };

    useEffect(() => {
        if (homes.current?.isOwner && homes.current?.dataSource?.id) {
            loadDataSource();
        } else {
            setDataSource(undefined);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homes.current?.id, homes.current?.dataSource?.id]);

    if (loading || homes.loading) return <Loading />;

    if (!homes.current) {
        router.replace("/");
        return null;
    }

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
        ...(homes.current.isOwner
            ? [{ icon: "trash-outline", label: "Delete Home", onPress: deleteClicked }]
            : [{ icon: "exit-outline", label: "Leave Home", onPress: leaveHomeAlert }]),
    ];

    return (
        <View style={{ flex: 1 }}>
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Home"
                content="All rooms, devices, automations, and settings in this home will be permanently deleted. This action cannot be undone."
                confirmLabel="Delete"
                iconName="home-outline"
                onConfirm={() => {
                    setShowDeleteDialog(false);
                    deleteHome();
                }}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <ConfirmDialog
                visible={showLeaveDialog}
                title="Leave Home"
                content="You will lose access to this home's devices and automations. The owner can re-invite you later."
                confirmLabel="Leave"
                destructive={false}
                iconName="exit-outline"
                onConfirm={() => {
                    setShowLeaveDialog(false);
                    leaveHome();
                }}
                onCancel={() => setShowLeaveDialog(false)}
            />
            <HomeForm
                ref={formRef}
                edit={true}
                onSubmit={editClicked}
                onDirtyChange={setIsFormDirty}
                initIcon={homes.current!.icon}
                initName={homes.current!.name}
                initLatitude={homes.current!.location?.latitude}
                initLongitude={homes.current!.location?.longitude}
                initIsOwner={homes.current?.isOwner}>
                {homes.current?.isOwner && (
                    <View>
                        <Expander title="Data Source" padding={{ paddingLeft: 15 }}>
                            <View style={{ paddingHorizontal: 15 }}>
                                {dataSource?.id ? (
                                    <View>
                                        <DataSourceTile
                                            id={dataSource.id!}
                                            name={dataSource.name!}
                                            server={dataSource.url!}
                                        />

                                        <ButtonWithTextAndImage
                                            title="Unlink Data Source"
                                            type="alternative"
                                            icon="unlink-outline"
                                            onPress={unlinkDataSource}
                                            loading={unlinkLoading}
                                            style={{ padding: 0, paddingTop: 10 }}
                                        />
                                    </View>
                                ) : (
                                    <ButtonWithTextAndImage
                                        title="Assign Data Source"
                                        onPress={onSelectDataSource}
                                        loading={false}
                                        style={{ padding: 0 }}
                                    />
                                )}
                            </View>
                        </Expander>

                        <Expander title="Sharing" padding={{ paddingLeft: 15 }}>
                            <View style={{ paddingHorizontal: 15 }}>
                                <HomeSharingList />
                            </View>
                        </Expander>
                    </View>
                )}
            </HomeForm>

            <FAB actions={fabActions} forceExpanded={isFormDirty} />
        </View>
    );
}

export default DetailsPage;
