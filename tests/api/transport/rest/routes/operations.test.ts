import { Code } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
    OperationsService,
    CreateOperationRequestSchema,
    DeleteOperationRequestSchema,
    DisplayOperationsRequestSchema,
    GetOperationRequestSchema,
} from "@/api/gen/devices/v1/operations_pb";
import { operationsRoutes } from "@/api/transport/rest/routes/operations";
import { routeKey } from "@/api/transport/rest/RestRoute";

const route = (name: keyof typeof OperationsService.method) =>
    operationsRoutes.find((e) => e.key === routeKey(OperationsService.method[name]))!.route;

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("operations REST routes", () => {
    it("covers every RPC", () => {
        expect(operationsRoutes.map((e) => e.key).sort()).toEqual(
            OperationsService.methods.map((m) => routeKey(m)).sort(),
        );
    });

    it("createOperation", () => {
        const r = route("createOperation");
        const req = create(CreateOperationRequestSchema, {
            deviceId: "d1",
            name: "n",
            type: "Number",
            configuration: { min: 1 },
            topic: "a/b",
        });
        expect(r.method).toBe("POST");
        expect(r.path(req as never)).toBe("v1/devices/operations");
        expect(plain(r.body!(req as never))).toEqual({
            deviceId: "d1",
            name: "n",
            type: "Number",
            configuration: { min: 1 },
            topic: "a/b",
        });
        expect(r.response({ id: "o1" }, 201)).toEqual({ id: "o1" });
    });

    it("getOperation", () => {
        const r = route("getOperation");
        expect(r.method).toBe("GET");
        expect(r.path(create(GetOperationRequestSchema, { operationId: "o1" }) as never)).toBe(
            "v1/devices/operations/o1",
        );
        expect(
            r.response({ id: "o1", topic: "t", name: "n", type: "Text", configuration: null }, 200),
        ).toEqual({ id: "o1", topic: "t", name: "n", type: "Text", configuration: {} });
    });

    it("deleteOperation", () => {
        const r = route("deleteOperation");
        expect(r.method).toBe("DELETE");
        expect(r.path(create(DeleteOperationRequestSchema, { operationId: "o1" }) as never)).toBe(
            "v1/devices/operations/o1",
        );
        expect(r.response(undefined, 204)).toEqual({});
    });

    it("displayOperations query omits zero page/size", () => {
        const r = route("displayOperations");
        expect(r.method).toBe("GET");
        const mk = (init: object) =>
            create(DisplayOperationsRequestSchema, { deviceId: "d1", ...init }) as never;
        expect(r.path(mk({}))).toBe("v1/devices/operations/display?deviceId=d1");
        expect(r.path(mk({ page: 2, size: 5 }))).toBe(
            "v1/devices/operations/display?deviceId=d1&page=2&size=5",
        );
        expect(r.response({ items: [{ id: "o1", name: "n", type: "Text" }] }, 200)).toEqual({
            items: [{ id: "o1", name: "n", type: "Text" }],
        });
    });

    it("rejects empty path ids", () => {
        expect(() =>
            route("getOperation").path(create(GetOperationRequestSchema) as never),
        ).toThrow(expect.objectContaining({ code: Code.InvalidArgument }));
    });
});
