import { fromJson, toJson, type JsonObject, type JsonValue } from "@bufbuild/protobuf";
import { ValueSchema, type Value } from "@bufbuild/protobuf/wkt";

/** Converts any JSON value into a protobuf `Value` (undefined becomes null). */
export const toProtoValue = (json: unknown): Value =>
    fromJson(ValueSchema, (json ?? null) as JsonValue);

/** Converts a protobuf `Value` into plain JSON (undefined becomes null). */
export const fromProtoValue = (v: Value | undefined): unknown =>
    v === undefined || v.kind.case === undefined ? null : toJson(ValueSchema, v);

/** A protobuf `Struct` as a plain object; `{}` when unset. */
export const structToJson = (s: JsonObject | undefined): Record<string, unknown> => s ?? {};
