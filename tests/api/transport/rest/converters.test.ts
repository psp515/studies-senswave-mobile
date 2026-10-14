import { Code } from "@connectrpc/connect";
import { idResponse, seg, timestampFromIso } from "@/api/transport/rest/converters";

describe("seg", () => {
    it("encodes a value", () => {
        expect(seg("a b/c", "id")).toBe("a%20b%2Fc");
    });

    it("rejects empty with InvalidArgument naming the parameter", () => {
        expect(() => seg("", "homeId")).toThrow(
            expect.objectContaining({ code: Code.InvalidArgument }),
        );
        expect(() => seg("", "homeId")).toThrow(/homeId/);
    });
});

describe("idResponse", () => {
    it("reads id and tolerates junk", () => {
        expect(idResponse({ id: "x" })).toEqual({ id: "x" });
        expect(idResponse(null)).toEqual({ id: "" });
    });
});

describe("timestampFromIso", () => {
    const seconds = (v: unknown) => timestampFromIso(v)?.seconds;

    it("treats a zone-less string as UTC", () => {
        expect(seconds("2026-01-02T03:04:05")).toBe(seconds("2026-01-02T03:04:05Z"));
        expect(seconds("2026-01-02T03:04:05")).toBeDefined();
    });

    it("keeps explicit offsets", () => {
        expect(seconds("2026-01-02T03:04:05+02:00")).toBe(seconds("2026-01-02T01:04:05Z"));
        expect(seconds("2026-01-02T03:04:05-01:30")).toBe(seconds("2026-01-02T04:34:05Z"));
    });

    it("returns undefined for invalid or non-strings", () => {
        expect(timestampFromIso("nope")).toBeUndefined();
        expect(timestampFromIso(5)).toBeUndefined();
    });
});
