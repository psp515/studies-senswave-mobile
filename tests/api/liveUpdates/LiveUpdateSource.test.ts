import { Code, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { LiveUpdateSchema, type LiveUpdate } from "@/api/gen/liveupdates/v1/liveupdates_pb";
import {
    createGrpcLiveUpdateSource,
    signalRUpdateToLiveUpdate,
} from "@/api/liveUpdates/LiveUpdateSource";
import type { ApiError } from "@/api/errors";

const tile = (deviceId: string) =>
    create(LiveUpdateSchema, { update: { case: "deviceTile", value: { deviceId } } });

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("signalRUpdateToLiveUpdate", () => {
    it("maps deviceTileActionUpdate", () => {
        expect(
            signalRUpdateToLiveUpdate("deviceTileActionUpdate", { deviceId: "d1" })?.update,
        ).toEqual({
            case: "deviceTile",
            value: expect.objectContaining({ deviceId: "d1" }),
        });
    });
    it("maps widgetsActionUpdate with empty widgetIds", () => {
        const u = signalRUpdateToLiveUpdate("widgetsActionUpdate", { deviceId: "d1" });
        expect(u?.update.case).toBe("widgets");
        expect((u?.update.value as any).deviceId).toBe("d1");
        expect((u?.update.value as any).widgetIds).toEqual([]);
    });
    it("maps dataSourceStateUpdate", () => {
        const u = signalRUpdateToLiveUpdate("dataSourceStateUpdate", {
            dataSourceId: "ds",
            state: "Connected",
        });
        expect(u?.update.case).toBe("dataSourceState");
        expect(u?.update.value).toEqual(
            expect.objectContaining({ dataSourceId: "ds", state: "Connected" }),
        );
    });
    it("maps devicePresenceUpdate", () => {
        const u = signalRUpdateToLiveUpdate("devicePresenceUpdate", { deviceId: "d2" });
        expect(u?.update.case).toBe("devicePresence");
        expect(u?.update.value).toEqual(expect.objectContaining({ deviceId: "d2" }));
    });
    it("returns null for unknown types", () => {
        expect(signalRUpdateToLiveUpdate("nope", {})).toBeNull();
    });
    it("uses empty strings for missing fields", () => {
        const u = signalRUpdateToLiveUpdate("dataSourceStateUpdate", undefined);
        expect(u?.update.value).toEqual(expect.objectContaining({ dataSourceId: "", state: "" }));
        const t = signalRUpdateToLiveUpdate("deviceTileActionUpdate", null);
        expect(t?.update.value).toEqual(expect.objectContaining({ deviceId: "" }));
    });
});

describe("createGrpcLiveUpdateSource", () => {
    it("emits updates then Unavailable when the stream ends", async () => {
        const subscribe = jest.fn(async function* () {
            yield tile("a");
            yield tile("b");
        });
        const source = createGrpcLiveUpdateSource({ subscribe } as any);
        const onUpdate = jest.fn();
        const onError = jest.fn();
        source.subscribe("home1", onUpdate, onError);
        await flush();
        expect((subscribe.mock.calls as unknown[][])[0][0]).toEqual({ homeReferenceId: "home1" });
        expect(onUpdate).toHaveBeenCalledTimes(2);
        expect(onError).toHaveBeenCalledTimes(1);
        expect((onError.mock.calls[0][0] as ApiError).code).toBe(Code.Unavailable);
    });

    it("maps thrown ConnectError to ApiError", async () => {
        const subscribe = jest.fn(async function* () {
            yield tile("a");
            throw new ConnectError("denied", Code.PermissionDenied);
        });
        const source = createGrpcLiveUpdateSource({ subscribe } as any);
        const onError = jest.fn();
        source.subscribe("h", jest.fn(), onError);
        await flush();
        expect((onError.mock.calls[0][0] as ApiError).code).toBe(Code.PermissionDenied);
    });

    it("keeps the stream alive when onUpdate throws", async () => {
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const subscribe = jest.fn(async function* () {
            yield tile("a");
            yield tile("b");
        });
        const source = createGrpcLiveUpdateSource({ subscribe } as any);
        const onUpdate = jest
            .fn()
            .mockImplementationOnce(() => {
                throw new Error("boom");
            })
            .mockImplementation(() => undefined);
        const onError = jest.fn();
        source.subscribe("h", onUpdate, onError);
        await flush();
        expect(onUpdate).toHaveBeenCalledTimes(2);
        expect(errSpy).toHaveBeenCalled();
        expect((onError.mock.calls[0][0] as ApiError).code).toBe(Code.Unavailable);
        errSpy.mockRestore();
    });

    it("does not leak a throwing onError", async () => {
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const subscribe = jest.fn(async function* () {
            yield tile("a");
        });
        const source = createGrpcLiveUpdateSource({ subscribe } as any);
        const onError = jest.fn(() => {
            throw new Error("boom");
        });
        source.subscribe("h", jest.fn(), onError);
        await flush();
        expect(onError).toHaveBeenCalledTimes(1);
        errSpy.mockRestore();
    });

    it("stops delivering after unsubscribe", async () => {
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        const subscribe = jest.fn(async function* (_req: unknown, opts: { signal: AbortSignal }) {
            yield tile("a");
            await gate;
            if (opts.signal.aborted) return;
            yield tile("b");
        });
        const source = createGrpcLiveUpdateSource({ subscribe } as any);
        const received: LiveUpdate[] = [];
        const onError = jest.fn();
        const unsub = source.subscribe("h", (u) => received.push(u), onError);
        await flush();
        expect(received).toHaveLength(1);
        unsub();
        release();
        await flush();
        expect(received).toHaveLength(1);
        expect(onError).not.toHaveBeenCalled();
    });
});
