import { createClient, type Client, type Transport } from "@connectrpc/connect";
import { AutomationsService } from "@/api/gen/automations/v1/automations_pb";
import { DataSourcesService } from "@/api/gen/datasources/v1/datasources_pb";
import { DashboardsService } from "@/api/gen/devices/v1/dashboards_pb";
import { DevicesService } from "@/api/gen/devices/v1/devices_pb";
import { OperationsService } from "@/api/gen/devices/v1/operations_pb";
import { SharingService as DevicesSharingService } from "@/api/gen/devices/v1/sharing_pb";
import { WidgetsService } from "@/api/gen/devices/v1/widgets_pb";
import { HomesService } from "@/api/gen/homes/v1/homes_pb";
import { RoomsService } from "@/api/gen/homes/v1/rooms_pb";
import { SharingService as HomesSharingService } from "@/api/gen/homes/v1/sharing_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { AccountService } from "@/api/gen/users/v1/account_pb";
import { AuthService } from "@/api/gen/users/v1/auth_pb";
import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { UsersService } from "@/api/gen/users/v1/users_pb";

export interface ApiClients {
    homes: Client<typeof HomesService>;
    rooms: Client<typeof RoomsService>;
    homeSharing: Client<typeof HomesSharingService>;
    devices: Client<typeof DevicesService>;
    dashboards: Client<typeof DashboardsService>;
    operations: Client<typeof OperationsService>;
    widgets: Client<typeof WidgetsService>;
    deviceSharing: Client<typeof DevicesSharingService>;
    automations: Client<typeof AutomationsService>;
    dataSources: Client<typeof DataSourcesService>;
    users: Client<typeof UsersService>;
    account: Client<typeof AccountService>;
    auth: Client<typeof AuthService>;
    legal: Client<typeof LegalService>;
    liveUpdates: Client<typeof LiveUpdatesService>;
}

export const createApiClients = (transport: Transport): ApiClients => ({
    homes: createClient(HomesService, transport),
    rooms: createClient(RoomsService, transport),
    homeSharing: createClient(HomesSharingService, transport),
    devices: createClient(DevicesService, transport),
    dashboards: createClient(DashboardsService, transport),
    operations: createClient(OperationsService, transport),
    widgets: createClient(WidgetsService, transport),
    deviceSharing: createClient(DevicesSharingService, transport),
    automations: createClient(AutomationsService, transport),
    dataSources: createClient(DataSourcesService, transport),
    users: createClient(UsersService, transport),
    account: createClient(AccountService, transport),
    auth: createClient(AuthService, transport),
    legal: createClient(LegalService, transport),
    liveUpdates: createClient(LiveUpdatesService, transport),
});
