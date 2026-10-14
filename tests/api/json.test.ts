import { create } from "@bufbuild/protobuf";
import { timestampFromDate, ValueSchema } from "@bufbuild/protobuf/wkt";
import {
    fromProtoValue,
    isoFromTimestamp,
    isoOrNull,
    structToJson,
    toProtoValue,
} from "@/api/json";

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

    it("isoFromTimestamp formats ISO and falls back when unset", () => {
        const t = timestampFromDate(new Date("2026-01-02T03:04:05.000Z"));
        expect(isoFromTimestamp(t)).toBe("2026-01-02T03:04:05.000Z");
        expect(isoFromTimestamp(undefined)).toBe("");
        expect(isoFromTimestamp(undefined, "n/a")).toBe("n/a");
    });

    it("isoOrNull returns null when unset", () => {
        const t = timestampFromDate(new Date("2026-01-02T03:04:05.000Z"));
        expect(isoOrNull(t)).toBe("2026-01-02T03:04:05.000Z");
        expect(isoOrNull(undefined)).toBeNull();
    });
});
