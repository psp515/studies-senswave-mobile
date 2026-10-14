import { create } from "@bufbuild/protobuf";
import {
    HomesService,
    CreateHomeRequestSchema,
    DeleteHomeDataSourceRequestSchema,
    GetCurrentHomeRequestSchema,
    GetHomeRequestSchema,
    GetHomesRequestSchema,
    SetHomeDataSourceRequestSchema,
    UpdateHomeRequestSchema,
} from "@/api/gen/homes/v1/homes_pb";
import { homesRoutes } from "@/api/transport/rest/routes/homes";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof HomesService.method) =>
    homesRoutes.find((e) => e.key === routeKey(HomesService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("homes REST routes", () => {
    it("covers every RPC", () => {
        expect(homesRoutes.map((e) => e.key).sort()).toEqual(
            HomesService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("getHomes path omits zero page/size", () => {
        const r = route("getHomes");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetHomesRequestSchema, { page: 2, size: 5 }) as never)).toBe(
            "v1/homes?page=2&size=5",
        );
        expect(r.path(create(GetHomesRequestSchema, { page: 0, size: 0 }) as never)).toBe(
            "v1/homes",
        );
    });

    it("getHomes response maps items", () => {
        const out = route("getHomes").response(
            {
                items: [
                    {
                        id: "h1",
                        dataSourceId: null,
                        name: "n",
                        icon: "i",
                        isOwner: true,
                        location: { longitude: 1, latitude: 2 },
                    },
                ],
            },
            200,
        );
        expect(out).toEqual({
            items: [
                {
                    id: "h1",
                    dataSourceId: undefined,
                    name: "n",
                    icon: "i",
                    isOwner: true,
                    location: { longitude: 1, latitude: 2 },
                },
            ],
        });
    });

    it("getHome path and response", () => {
        const r = route("getHome");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetHomeRequestSchema, { homeId: "h1" }) as never)).toBe("v1/homes/h1");
        const base = {
            id: "h1",
            name: "n",
            icon: "i",
            isOwner: true,
            location: { longitude: 1, latitude: 2 },
            rooms: [{ id: "r1", name: "Kitchen" }],
        };
        expect(r.response({ ...base, dataSource: null }, 200)).toEqual({
            ...base,
            dataSource: undefined,
        });
        expect(
            r.response({ ...base, dataSource: { id: null, state: "Empty", name: "" } }, 200),
        ).toEqual({ ...base, dataSource: { id: undefined, state: "Empty", name: "" } });
        expect(
            r.response({ ...base, dataSource: { id: "d1", state: "Connected", name: "b" } }, 200),
        ).toEqual({ ...base, dataSource: { id: "d1", state: "Connected", name: "b" } });
    });

    it("getCurrentHome path and response", () => {
        const r = route("getCurrentHome");
        expect(r.method).toBe("GET");
        expect(
            r.path(create(GetCurrentHomeRequestSchema, { latitude: 1.5, longitude: 2.5 }) as never),
        ).toBe("v1/homes/current?latitude=1.5&longitude=2.5");
        expect(r.path(create(GetCurrentHomeRequestSchema, {}) as never)).toBe("v1/homes/current");
        expect(r.response({ id: "h9" }, 200)).toEqual({ id: "h9" });
    });

    it("createHome body omits undefined coords and never sends dataSourceId", () => {
        const r = route("createHome");
        expect(r.method).toBe("POST");
        expect(r.path({} as never)).toBe("v1/homes");
        const body = r.body!(
            create(CreateHomeRequestSchema, { name: "n", icon: "i", dataSourceId: "d" }) as never,
        );
        expect(plain(body)).toEqual({ name: "n", icon: "i" });
        expect(body).not.toHaveProperty("dataSourceId");
        const withCoords = r.body!(
            create(CreateHomeRequestSchema, {
                name: "n",
                icon: "i",
                latitude: 1,
                longitude: 2,
            }) as never,
        );
        expect(plain(withCoords)).toEqual({ name: "n", icon: "i", latitude: 1, longitude: 2 });
        expect(r.response({ id: "h1" }, 201)).toEqual({ id: "h1" });
    });

    it("updateHome sends name/icon only when non-empty", () => {
        const r = route("updateHome");
        expect(r.method).toBe("PATCH");
        expect(r.path(create(UpdateHomeRequestSchema, { homeId: "h1" }) as never)).toBe(
            "v1/homes/h1",
        );
        const body = r.body!(
            create(UpdateHomeRequestSchema, { homeId: "h1", name: "", icon: "x" }) as never,
        );
        expect(plain(body)).toEqual({ icon: "x" });
        const body2 = r.body!(
            create(UpdateHomeRequestSchema, { homeId: "h1", name: "n", latitude: 3 }) as never,
        );
        expect(plain(body2)).toEqual({ name: "n", latitude: 3 });
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("deleteHome", () => {
        const r = route("deleteHome");
        expect(r.method).toBe("DELETE");
        expect(r.path({ homeId: "h1" } as never)).toBe("v1/homes/h1");
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("setHomeDataSource and deleteHomeDataSource", () => {
        const s = route("setHomeDataSource");
        const req = create(SetHomeDataSourceRequestSchema, { homeId: "h1", brokerId: "b1" });
        expect(s.method).toBe("PUT");
        expect(s.path(req as never)).toBe("v1/homes/h1/datasource");
        expect(s.body!(req as never)).toEqual({ brokerId: "b1" });
        expect(s.response(undefined, 204)).toEqual({});
        const d = route("deleteHomeDataSource");
        expect(d.method).toBe("DELETE");
        expect(d.path(create(DeleteHomeDataSourceRequestSchema, { homeId: "h1" }) as never)).toBe(
            "v1/homes/h1/datasource",
        );
        expect(d.response(undefined, 204)).toEqual({});
    });
});
