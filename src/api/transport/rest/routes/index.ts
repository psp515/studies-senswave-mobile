import type { RestRouteRegistryEntry } from "../RestRoute";
import { authRoutes } from "./auth";
import { legalRoutes } from "./legal";
import { usersRoutes } from "./users";

// Later PRs append homes, rooms, sharing, devices, dashboards, operations, widgets, automations, dataSources, account.
export const restRoutes: RestRouteRegistryEntry[] = [...usersRoutes, ...legalRoutes, ...authRoutes];
