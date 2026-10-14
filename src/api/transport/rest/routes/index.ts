import type { RestRouteRegistryEntry } from "../RestRoute";
import { authRoutes } from "./auth";
import { dashboardsRoutes } from "./dashboards";
import { deviceSharingRoutes } from "./deviceSharing";
import { devicesRoutes } from "./devices";
import { homeSharingRoutes } from "./homeSharing";
import { homesRoutes } from "./homes";
import { legalRoutes } from "./legal";
import { operationsRoutes } from "./operations";
import { roomsRoutes } from "./rooms";
import { usersRoutes } from "./users";
import { widgetsRoutes } from "./widgets";

// Later PRs append automations, dataSources, account.
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
];
