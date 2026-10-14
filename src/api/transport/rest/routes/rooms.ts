import { RoomsService } from "@/api/gen/homes/v1/rooms_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, items, str } from "../converters";

const enc = encodeURIComponent;

export const roomsRoutes = defineRoutes(RoomsService, {
    displayRooms: {
        method: "GET",
        path: (req) => `v1/homes/${enc(req.homeId)}/rooms/display`,
        response: (json) => ({
            items: items(json, (r) => ({ id: str(r.id), name: str(r.name) })),
        }),
    },
    getRoom: {
        method: "GET",
        path: (req) => `v1/homes/${enc(req.homeId)}/rooms/${enc(req.roomId)}`,
        response: (json) => {
            const j = asRecord(json);
            return { id: str(j.id), name: str(j.name) };
        },
    },
    createRoom: {
        method: "POST",
        path: (req) => `v1/homes/${enc(req.homeId)}/rooms`,
        body: (req) => ({ name: req.name }),
        response: (json) => ({ id: str(asRecord(json).id) }),
    },
    updateRoom: {
        method: "PATCH",
        path: (req) => `v1/homes/${enc(req.homeId)}/rooms/${enc(req.roomId)}`,
        body: (req) => ({ name: req.name }),
        response: empty,
    },
    deleteRoom: {
        method: "DELETE",
        path: (req) => `v1/homes/${enc(req.homeId)}/rooms/${enc(req.roomId)}`,
        response: empty,
    },
});
