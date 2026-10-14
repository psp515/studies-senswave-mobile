import { create } from "@bufbuild/protobuf";
import { ValueSchema } from "@bufbuild/protobuf/wkt";
import { fromProtoValue, structToJson, toProtoValue } from "@/api/json";

describe("json helpers", () => {
    it.each([["text"], [1.5], [true], [false], [null]])("round-trips %p", (v) => {
        expect(fromProtoValue(toProtoValue(v))).toEqual(v);
    });

    it("round-trips objects", () => {
        expect(fromProtoValue(toProtoValue({ a: 1, b: [true, "x"] }))).toEqual({
            a: 1,
            b: [true, "x"],
        });
    });

    it("maps undefined to null / null value", () => {
        expect(fromProtoValue(undefined)).toBeNull();
        expect(toProtoValue(undefined).kind.case).toBe("nullValue");
        expect(fromProtoValue(create(ValueSchema))).toBeNull();
    });

    it("structToJson returns {} for undefined", () => {
        expect(structToJson(undefined)).toEqual({});
        expect(structToJson({ a: 1 })).toEqual({ a: 1 });
    });
});
