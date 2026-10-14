import { create } from "@bufbuild/protobuf";
import { GetHomeResponseSchema } from "@/api/gen/homes/v1/homes_pb";
import { toHome } from "@/types/HomeTypes";

describe("toHome", () => {
    it("maps all fields", () => {
        const home = toHome(
            create(GetHomeResponseSchema, {
                id: "h1",
                name: "Home",
                icon: "house",
                isOwner: true,
                dataSource: { id: "d1", name: "Broker", state: "Connected" },
                location: { latitude: 1.5, longitude: 2.5 },
                rooms: [{ id: "r1", name: "Kitchen" }],
            }),
        );
        expect(home).toEqual({
            id: "h1",
            name: "Home",
            icon: "house",
            isOwner: true,
            dataSource: { id: "d1", name: "Broker", state: "Connected" },
            location: { latitude: 1.5, longitude: 2.5 },
            rooms: [{ id: "r1", name: "Kitchen" }],
        });
    });

    it("defaults a missing location to 0,0", () => {
        const home = toHome(create(GetHomeResponseSchema, { id: "h1" }));
        expect(home.location).toEqual({ latitude: 0, longitude: 0 });
    });

    it("leaves an unset dataSource undefined", () => {
        expect(toHome(create(GetHomeResponseSchema, { id: "h1" })).dataSource).toBeUndefined();
    });

    it("maps empty rooms to []", () => {
        expect(toHome(create(GetHomeResponseSchema, { id: "h1" })).rooms).toEqual([]);
    });
});
