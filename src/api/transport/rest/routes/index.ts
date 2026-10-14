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

// Later PRs append account.
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
