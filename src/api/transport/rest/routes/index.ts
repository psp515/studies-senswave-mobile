import type { RestRouteRegistryEntry } from "../RestRoute";
import { authRoutes } from "./auth";
import { automationsRoutes } from "./automations";
import { dashboardsRoutes } from "./dashboards";
import { dataSourcesRoutes } from "./dataSources";
import { deviceSharingRoutes } from "./deviceSharing";
import { devicesRoutes } from "./devices";
import { homeSharingRoutes } from "./homeSharing";
import { homesRoutes } from "./homes";
import { legalRoutes } from "./legal";
import { operationsRoutes } from "./operations";
import { roomsRoutes } from "./rooms";
import { usersRoutes } from "./users";
import { widgetsRoutes } from "./widgets";

// AccountService and LiveUpdatesService have no REST routes: Account is unused by the app; live updates use SignalR in REST mode (see LiveUpdateSource).
export const restRoutes: RestRouteRegistryEntry[] = [
    ...usersRoutes,
    ...legalRoutes,
    ...authRoutes,
    ...homesRoutes,
    ...roomsRoutes,
    ...homeSharingRoutes,
    ...devicesRoutes,
    ...deviceSharingRoutes,
    ...dashboardsRoutes,
    ...operationsRoutes,
    ...widgetsRoutes,
    ...automationsRoutes,
    ...dataSourcesRoutes,
];
