import { RoomsService } from "@/api/gen/homes/v1/rooms_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, idResponse, items, seg, str } from "../converters";

export const roomsRoutes = defineRoutes(RoomsService, {
    displayRooms: {
        method: "GET",
        path: (req) => `v1/homes/${seg(req.homeId, "homeId")}/rooms/display`,
        response: (json) => ({
            items: items(json, (r) => ({ id: str(r.id), name: str(r.name) })),
        }),
    },
    getRoom: {
        method: "GET",
        path: (req) => `v1/homes/${seg(req.homeId, "homeId")}/rooms/${seg(req.roomId, "roomId")}`,
        response: (json) => {
            const j = asRecord(json);
            return { id: str(j.id), name: str(j.name) };
        },
    },
    createRoom: {
        method: "POST",
        path: (req) => `v1/homes/${seg(req.homeId, "homeId")}/rooms`,
        body: (req) => ({ name: req.name }),
        response: idResponse,
    },
    updateRoom: {
        method: "PATCH",
        path: (req) => `v1/homes/${seg(req.homeId, "homeId")}/rooms/${seg(req.roomId, "roomId")}`,
        body: (req) => ({ name: req.name }),
        response: empty,
    },
    deleteRoom: {
        method: "DELETE",
        path: (req) => `v1/homes/${seg(req.homeId, "homeId")}/rooms/${seg(req.roomId, "roomId")}`,
        response: empty,
    },
});
