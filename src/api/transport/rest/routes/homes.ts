import { HomesService } from "@/api/gen/homes/v1/homes_pb";
import { defineRoutes } from "../RestRoute";
import {
    asRecord,
    bool,
    empty,
    items,
    num,
    numOrUndefined,
    query,
    str,
    strOrUndefined,
} from "../converters";

const location = (v: unknown) => {
    if (v === null || v === undefined) return undefined;
    const l = asRecord(v);
    return { longitude: num(l.longitude), latitude: num(l.latitude) };
};

const idResponse = (json: unknown) => ({ id: str(asRecord(json).id) });

const enc = encodeURIComponent;

export const homesRoutes = defineRoutes(HomesService, {
    getHomes: {
        method: "GET",
        path: (req) =>
            `v1/homes${query({ page: req.page || undefined, size: req.size || undefined })}`,
        response: (json) => ({
            items: items(json, (h) => ({
                id: str(h.id),
                dataSourceId: strOrUndefined(h.dataSourceId),
                name: str(h.name),
                icon: str(h.icon),
                isOwner: bool(h.isOwner),
                location: location(h.location),
            })),
        }),
    },
    getHome: {
        method: "GET",
        path: (req) => `v1/homes/${enc(req.homeId)}`,
        response: (json) => {
            const j = asRecord(json);
            const ds =
                j.dataSource === null || j.dataSource === undefined
                    ? undefined
                    : asRecord(j.dataSource);
            return {
                id: str(j.id),
                name: str(j.name),
                icon: str(j.icon),
                isOwner: bool(j.isOwner),
                dataSource: ds
                    ? { id: strOrUndefined(ds.id), state: str(ds.state), name: str(ds.name) }
                    : undefined,
                location: location(j.location),
                rooms: items(j.rooms, (r) => ({ id: str(r.id), name: str(r.name) })),
            };
        },
    },
    getCurrentHome: {
        method: "GET",
        path: (req) =>
            `v1/homes/current${query({ latitude: req.latitude, longitude: req.longitude })}`,
        response: idResponse,
    },
    createHome: {
        method: "POST",
        path: () => "v1/homes",
        body: (req) => ({
            name: req.name,
            icon: req.icon,
            latitude: numOrUndefined(req.latitude),
            longitude: numOrUndefined(req.longitude),
        }),
        response: idResponse,
    },
    updateHome: {
        method: "PATCH",
        path: (req) => `v1/homes/${enc(req.homeId)}`,
        body: (req) => ({
            name: req.name || undefined,
            icon: req.icon || undefined,
            latitude: numOrUndefined(req.latitude),
            longitude: numOrUndefined(req.longitude),
        }),
        response: empty,
    },
    deleteHome: {
        method: "DELETE",
        path: (req) => `v1/homes/${enc(req.homeId)}`,
        response: empty,
    },
    setHomeDataSource: {
        method: "PUT",
        path: (req) => `v1/homes/${enc(req.homeId)}/datasource`,
        body: (req) => ({ brokerId: req.brokerId }),
        response: empty,
    },
    deleteHomeDataSource: {
        method: "DELETE",
        path: (req) => `v1/homes/${enc(req.homeId)}/datasource`,
        response: empty,
    },
});
