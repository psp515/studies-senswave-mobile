import { SharingService } from "@/api/gen/devices/v1/sharing_pb";
import { defineRoutes } from "../RestRoute";
import { empty, items, query, required, seg, str, strOrUndefined } from "../converters";

export const deviceSharingRoutes = defineRoutes(SharingService, {
    getSharings: {
        method: "GET",
        path: (req) =>
            `v1/devices/sharings${query({ deviceId: required(req.deviceId, "deviceId") })}`,
        response: (json) => ({
            items: items(json, (s) => ({
                sharingId: strOrUndefined(s.sharingId),
                friendEmail: str(s.friendEmail),
                sharingType: str(s.sharingType),
            })),
        }),
    },
    setSharing: {
        method: "PUT",
        path: () => "v1/devices/sharings",
        body: (req) => ({
            deviceId: req.deviceId,
            sharingType: req.sharingType,
            friendEmail: req.friendEmail,
        }),
        response: empty,
    },
    deleteSharing: {
        method: "DELETE",
        path: (req) => `v1/devices/sharings/${seg(req.deviceSharingId, "deviceSharingId")}`,
        response: empty,
    },
});
