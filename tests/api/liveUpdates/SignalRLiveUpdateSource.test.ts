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
    it("starts and invokes Initialize without emitting initialized itself", async () => {
        const s = setup();
        await flush();
        expect(s.buildConnection).toHaveBeenCalledWith("http://x/hub", expect.any(Function));
        expect(s.fake.start).toHaveBeenCalled();
        expect(s.fake.invoke).toHaveBeenCalledWith("Initialize", "home1");
        expect(s.onUpdate).not.toHaveBeenCalled();
        expect(s.onError).not.toHaveBeenCalled();
    });

    it("registers only the hub events", () => {
        const s = setup();
        expect([...s.handlers.keys()].sort()).toEqual([
            "AccessNotGrantedToHome",
            "FailedToInitialize",
            "Initialized",
            "Update",
        ]);
    });

    it("emits initialized when the hub sends Initialized", async () => {
        const s = setup();
        await flush();
        s.handlers.get("Initialized")!();
        expect(s.onUpdate).toHaveBeenCalledTimes(1);
        expect(s.onUpdate.mock.calls[0][0].update.case).toBe("initialized");
        expect(s.onError).not.toHaveBeenCalled();
    });

    it("reports FailedToInitialize about access as PermissionDenied once and stops", async () => {
        const s = setup();
        await flush();
        s.handlers.get("FailedToInitialize")!("No access to home.");
        s.handlers.get("FailedToInitialize")!("No access to home.");
        expect(s.onError).toHaveBeenCalledTimes(1);
        const err = s.onError.mock.calls[0][0] as ApiError;
        expect(err.code).toBe(Code.PermissionDenied);
        expect(err.message).toContain("No access to home.");
        expect(s.fake.stop).toHaveBeenCalled();
    });

    it("reports other FailedToInitialize reasons as Unavailable", async () => {
        const s = setup();
        await flush();
        s.handlers.get("FailedToInitialize")!("Too many requests");
        expect((s.onError.mock.calls[0][0] as ApiError).code).toBe(Code.Unavailable);
    });

    it("maps Update events and ignores unknown ones", async () => {
        const s = setup();
        await flush();
        s.handlers.get("Update")!("deviceTileActionUpdate", { deviceId: "d1" });
        s.handlers.get("Update")!("mystery", {});
        expect(s.onUpdate).toHaveBeenCalledTimes(1);
        expect(s.onUpdate.mock.calls[0][0].update).toEqual({
            case: "deviceTile",
            value: expect.objectContaining({ deviceId: "d1" }),
        });
    });

    it("keeps AccessNotGrantedToHome as a PermissionDenied alias", async () => {
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

    it("reports invoke rejection once and stops the connection", async () => {
        const f = makeFake();
        f.fake.invoke.mockImplementation(() => Promise.reject(new Error("bad")));
        const source = createSignalRLiveUpdateSource({
            url: "u",
            getAccessToken: () => "t",
            buildConnection: () => f.fake as unknown as HubConnection,
        });
        const onError = jest.fn();
        source.subscribe("h", jest.fn(), onError);
        await flush();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(f.fake.stop).toHaveBeenCalled();
        f.close();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("passes an accessTokenFactory that reads the current token", () => {
        const f = makeFake();
        let token = "one";
        let factory!: () => string;
        createSignalRLiveUpdateSource({
            url: "u",
            getAccessToken: () => token,
            buildConnection: (_u, tf) => {
                factory = tf;
                return f.fake as unknown as HubConnection;
            },
        }).subscribe("h", jest.fn(), jest.fn());
        expect(factory()).toBe("one");
        token = "two";
        expect(factory()).toBe("two");
    });
});
