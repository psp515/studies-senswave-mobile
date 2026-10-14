import type { MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate, type TimestampSchema } from "@bufbuild/protobuf/wkt";

export const asRecord = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const str = (v: unknown): string => (typeof v === "string" ? v : "");

export const bool = (v: unknown): boolean => v === true;

export const num = (v: unknown): number => (typeof v === "number" ? v : 0);

export const empty = (): Record<string, never> => ({});

export const timestampFromIso = (
    iso: unknown,
): MessageInitShape<typeof TimestampSchema> | undefined => {
    if (typeof iso !== "string") return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return timestampFromDate(d);
};

/** Builds "?a=1&b=2" from defined values only; returns "" when nothing is defined. */
export const query = (params: Record<string, string | number | undefined>): string => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.length ? `?${parts.join("&")}` : "";
};

export const numOrUndefined = (v: unknown): number | undefined =>
    typeof v === "number" ? v : undefined;

export const strOrUndefined = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;

/** Maps `json.items` (or a bare array) element-wise; non-arrays yield []. */
export const items = <T>(json: unknown, map: (item: Record<string, unknown>) => T): T[] => {
    const list = Array.isArray(json) ? json : asRecord(json).items;
    return Array.isArray(list) ? list.map((i) => map(asRecord(i))) : [];
};
