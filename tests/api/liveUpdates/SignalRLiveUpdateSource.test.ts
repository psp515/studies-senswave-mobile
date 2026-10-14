import { Code } from "@connectrpc/connect";
import type { HubConnection } from "@microsoft/signalr";
import { createSignalRLiveUpdateSource } from "@/api/liveUpdates/SignalRLiveUpdateSource";
import type { ApiError } from "@/api/errors";

const flush = () => new Promise((r) => setTimeout(r, 0));

const makeFake = (startImpl: () => Promise<void> = () => Promise.resolve()) => {
    const handlers = new Map<string, (...args: any[]) => void>();
    let closeHandler: (() => void) | undefined;
    const fake = {
        on: jest.fn((name: string, h: (...args: any[]) => void) => handlers.set(name, h)),
        onclose: jest.fn((h: () => void) => {
            closeHandler = h;
        }),
        onreconnecting: jest.fn(),
        onreconnected: jest.fn(),
        start: jest.fn(startImpl),
        stop: jest.fn(() => Promise.resolve()),
        invoke: jest.fn(() => Promise.resolve()),
    };
    return { fake, handlers, close: () => closeHandler?.() };
};

const setup = (startImpl?: () => Promise<void>) => {
    const f = makeFake(startImpl);
    const buildConnection = jest.fn(
        (_u: string, _t: () => string) => f.fake as unknown as HubConnection,
    );
    const source = createSignalRLiveUpdateSource({
        url: "http://x/hub",
        getAccessToken: () => "tok",
        buildConnection,
    });
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const unsub = source.subscribe("home1", onUpdate, onError);
    return { ...f, buildConnection, onUpdate, onError, unsub };
};

describe("createSignalRLiveUpdateSource", () => {
    it("starts, invokes Initialize and emits initialized", async () => {
        const s = setup();
        await flush();
        expect(s.buildConnection).toHaveBeenCalledWith("http://x/hub", expect.any(Function));
        expect(s.fake.start).toHaveBeenCalled();
        expect(s.fake.invoke).toHaveBeenCalledWith("Initialize", "home1");
        expect(s.onUpdate).toHaveBeenCalledTimes(1);
        expect(s.onUpdate.mock.calls[0][0].update.case).toBe("initialized");
        expect(s.onError).not.toHaveBeenCalled();
    });

    it("maps Update events and ignores unknown ones", async () => {
        const s = setup();
        await flush();
        s.handlers.get("Update")!("deviceTileActionUpdate", { deviceId: "d1" });
        s.handlers.get("Update")!("mystery", {});
        expect(s.onUpdate).toHaveBeenCalledTimes(2);
        expect(s.onUpdate.mock.calls[1][0].update).toEqual({
            case: "deviceTile",
            value: expect.objectContaining({ deviceId: "d1" }),
        });
    });

    it("reports AccessNotGrantedToHome as PermissionDenied", async () => {
        const s = setup();
        await flush();
        s.handlers.get("AccessNotGrantedToHome")!("home1", "nope");
        expect((s.onError.mock.calls[0][0] as ApiError).code).toBe(Code.PermissionDenied);
    });

    it("reports onclose as Unavailable while subscribed", async () => {
        const s = setup();
        await flush();
        s.close();
        expect((s.onError.mock.calls[0][0] as ApiError).code).toBe(Code.Unavailable);
    });

    it("does not report onclose after unsubscribe and stops the connection", async () => {
        const s = setup();
        await flush();
        s.unsub();
        s.close();
        expect(s.fake.stop).toHaveBeenCalled();
        expect(s.onError).not.toHaveBeenCalled();
    });

    it("reports start rejection via onError", async () => {
        const s = setup(() => Promise.reject(new Error("boom")));
        await flush();
        expect(s.onError).toHaveBeenCalledTimes(1);
        expect(s.fake.invoke).not.toHaveBeenCalled();
        expect(s.onUpdate).not.toHaveBeenCalled();
    });

    it("suppresses start failure after unsubscribe", async () => {
        const s = setup(() => Promise.reject(new Error("boom")));
        s.unsub();
        await flush();
        expect(s.onError).not.toHaveBeenCalled();
    });
});
