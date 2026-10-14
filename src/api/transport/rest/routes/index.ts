import type { RestRouteRegistryEntry } from "../RestRoute";
import { authRoutes } from "./auth";
import { homeSharingRoutes } from "./homeSharing";
import { homesRoutes } from "./homes";
import { legalRoutes } from "./legal";
import { roomsRoutes } from "./rooms";
import { usersRoutes } from "./users";

// Later PRs append devices, dashboards, operations, widgets, automations, dataSources, account.
export const restRoutes: RestRouteRegistryEntry[] = [
    ...usersRoutes,
    ...legalRoutes,
    ...authRoutes,
    ...homesRoutes,
    ...roomsRoutes,
    ...homeSharingRoutes,
];
