import { base64encode } from "@protobuf-ts/runtime";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { Error as ProtoError, ErrorType } from "@/generated/common/v1/common";
import { apiErrorFromRpcError, decodeErrorTrailers } from "@/api/grpc/grpcErrors";

const encodeError = (code: string, description: string) =>
    base64encode(
        ProtoError.toBinary(ProtoError.create({ code, description, type: ErrorType.VALIDATION })),
    );

describe("decodeErrorTrailers", () => {
    it("decodes one entry per error from an array", () => {
        const meta = {
            "senswave-errors-bin": [encodeError("A", "First."), encodeError("B", "Second.")],
        };

        expect(decodeErrorTrailers(meta)).toEqual([
            { code: "A", description: "First." },
            { code: "B", description: "Second." },
        ]);
    });

    it("decodes comma-joined values from a single header string", () => {
        const meta = {
            "senswave-errors-bin": `${encodeError("A", "First.")}, ${encodeError("B", "Second.")}`,
        };

        expect(decodeErrorTrailers(meta).map((e) => e.code)).toEqual(["A", "B"]);
    });

    it("returns no errors when the trailer is missing", () => {
        expect(decodeErrorTrailers({})).toEqual([]);
    });

    it("skips an undecodable entry", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        expect(decodeErrorTrailers({ "senswave-errors-bin": "////" })).toEqual([]);
        warn.mockRestore();
    });
});

describe("apiErrorFromRpcError", () => {
    it("maps message, errors and trace id", () => {
        const error = new RpcError("Validation failed", "INVALID_ARGUMENT", {
            "senswave-errors-bin": [encodeError("Home.Name", "Name required.")],
            "senswave-trace-id": "trace-1",
        });

        expect(apiErrorFromRpcError(error)).toEqual({
            statusText: "Validation failed",
            errors: [{ code: "Home.Name", description: "Name required." }],
            traceId: "trace-1",
        });
    });
});
