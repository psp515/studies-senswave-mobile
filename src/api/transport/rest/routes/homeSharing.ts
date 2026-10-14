import { SharingService } from "@/api/gen/homes/v1/sharing_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, empty, items, query, seg, str, timestampFromIso } from "../converters";

export const homeSharingRoutes = defineRoutes(SharingService, {
    getSharings: {
        method: "GET",
        path: (req) => `v1/homes/sharings${query({ homeId: req.homeId })}`,
        response: (json) => ({
            items: items(json, (s) => ({
                sharingId: str(s.sharingId),
                friendEmail: str(s.friendEmail),
                sharingType: str(s.sharingType),
            })),
        }),
    },
    createSharing: {
        method: "POST",
        path: () => "v1/homes/sharings",
        body: (req) => ({
            homeId: req.homeId,
            friendEmail: req.friendEmail,
            sharingType: req.sharingType,
        }),
        response: (json) => {
            const j = asRecord(json);
            return {
                invitationId: str(j.invitationId),
                password: str(j.password),
                expiresAtUtc: timestampFromIso(j.expiresAtUtc),
                createdUtc: timestampFromIso(j.createdUtc),
            };
        },
    },
    acceptSharing: {
        method: "PUT",
        path: () => "v1/homes/sharings",
        body: (req) => ({ password: req.password }),
        response: empty,
    },
    deleteSharing: {
        method: "DELETE",
        path: (req) => `v1/homes/sharings/${seg(req.homeSharingId, "homeSharingId")}`,
        response: empty,
    },
    leaveSharing: {
        method: "DELETE",
        path: (req) => `v1/homes/sharings/leave/${seg(req.homeId, "homeId")}`,
        response: empty,
    },
});
