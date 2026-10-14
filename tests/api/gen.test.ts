import { HomesService } from "@/api/gen/homes/v1/homes_pb";
import { ErrorSchema, ErrorType } from "@/api/gen/common/v1/common_pb";
import { LiveUpdatesService } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";

describe("generated proto code", () => {
    it("exposes service descriptors with full type names", () => {
        expect(HomesService.typeName).toBe("senswave.homes.v1.HomesService");
        expect(HomesService.method.getHome.name).toBe("GetHome");
        expect(HomesService.method.getHome.methodKind).toBe("unary");
        expect(LiveUpdatesService.method.subscribe.methodKind).toBe("server_streaming");
    });

    it("round-trips a common Error", () => {
        const err = create(ErrorSchema, {
            code: "NotFound",
            type: ErrorType.NOT_FOUND,
            description: "Home not found",
        });
        const back = fromBinary(ErrorSchema, toBinary(ErrorSchema, err));
        expect(back.code).toBe("NotFound");
        expect(back.type).toBe(ErrorType.NOT_FOUND);
    });
});
