import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    RoomsService,
    CreateRoomRequestSchema,
    DeleteRoomRequestSchema,
    DisplayRoomsRequestSchema,
    GetRoomRequestSchema,
    UpdateRoomRequestSchema,
} from "@/api/gen/homes/v1/rooms_pb";
import { roomsRoutes } from "@/api/transport/rest/routes/rooms";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof RoomsService.method) =>
    roomsRoutes.find((e) => e.key === routeKey(RoomsService.method[name]))!.route;

describe("rooms REST routes", () => {
    it("covers every RPC", () => {
        expect(roomsRoutes.map((e) => e.key).sort()).toEqual(
            RoomsService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("displayRooms", () => {
        const r = route("displayRooms");
        expect(r.method).toBe("GET");
        expect(r.path(create(DisplayRoomsRequestSchema, { homeId: "h1" }) as never)).toBe(
            "v1/homes/h1/rooms/display",
        );
        expect(r.response({ items: [{ id: "r1", name: "A" }] }, 200)).toEqual({
            items: [{ id: "r1", name: "A" }],
        });
        expect(r.response(undefined, 200)).toEqual({ items: [] });
    });

    it("getRoom", () => {
        const r = route("getRoom");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetRoomRequestSchema, { homeId: "h1", roomId: "r1" }) as never)).toBe(
            "v1/homes/h1/rooms/r1",
        );
        expect(r.response({ id: "r1", name: "A" }, 200)).toEqual({ id: "r1", name: "A" });
    });

    it("createRoom", () => {
        const r = route("createRoom");
        const req = create(CreateRoomRequestSchema, { homeId: "h1", name: "A" });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/homes/h1/rooms");
        expect(r.body!(req as never)).toEqual({ name: "A" });
        expect(r.response({ id: "r1" }, 201)).toEqual({ id: "r1" });
    });

    it("updateRoom", () => {
        const r = route("updateRoom");
        const req = create(UpdateRoomRequestSchema, { homeId: "h1", roomId: "r1", name: "B" });
        expect(r.method).toBe("PATCH");
        expect(r.path(req as never)).toBe("v1/homes/h1/rooms/r1");
        expect(r.body!(req as never)).toEqual({ name: "B" });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteRoom", () => {
        const r = route("deleteRoom");
        expect(r.method).toBe("DELETE");
        expect(
            r.path(create(DeleteRoomRequestSchema, { homeId: "h1", roomId: "r1" }) as never),
        ).toBe("v1/homes/h1/rooms/r1");
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("rejects empty ids with InvalidArgument", () => {
        const invalid = expect.objectContaining({ code: Code.InvalidArgument });
        expect(() => route("displayRooms").path({ homeId: "" } as never)).toThrow(invalid);
        expect(() => route("createRoom").path({ homeId: "" } as never)).toThrow(invalid);
        expect(() => route("getRoom").path({ homeId: "h", roomId: "" } as never)).toThrow(invalid);
        expect(() => route("updateRoom").path({ homeId: "", roomId: "r" } as never)).toThrow(
            invalid,
        );
        expect(() => route("deleteRoom").path({ homeId: "h", roomId: "" } as never)).toThrow(
            invalid,
        );
    });
});
