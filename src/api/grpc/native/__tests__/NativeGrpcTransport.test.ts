import { base64encode } from "@protobuf-ts/runtime";
import { RpcError } from "@protobuf-ts/runtime-rpc";
import { GetPrivacyPolicyResponse } from "@/generated/users/v1/legal";
import { LegalServiceClient } from "@/generated/users/v1/legal.client";
import { LiveUpdate } from "@/generated/liveupdates/v1/liveupdates";
import { LiveUpdatesServiceClient } from "@/generated/liveupdates/v1/liveupdates.client";
import { NativeGrpcTransport } from "@/api/grpc/native/NativeGrpcTransport";
import {
    NativeGrpcBridge,
    NativeMetadata,
    NativeUnaryResult,
} from "@/api/grpc/native/nativeGrpcBridge";

type Listener = (event: any) => void;

class FakeBridge implements NativeGrpcBridge {
    unaryCalls: {
        callId: string;
        baseUrl: string;
        method: string;
        requestBase64: string;
        metadata: NativeMetadata;
        deadlineMs: number;
    }[] = [];
    streams: { callId: string; method: string; metadata: NativeMetadata; deadlineMs: number }[] =
        [];
    cancelled: string[] = [];
    unaryResult: Promise<NativeUnaryResult> = Promise.resolve({
        status: 0,
        message: "",
        responseBase64: "",
        headers: {},
        trailers: {},
    });
    private listeners = new Map<string, Set<Listener>>();

    unary(
        callId: string,
        baseUrl: string,
        method: string,
        requestBase64: string,
        metadata: NativeMetadata,
        deadlineMs: number,
    ) {
        this.unaryCalls.push({ callId, baseUrl, method, requestBase64, metadata, deadlineMs });
        return this.unaryResult;
    }

    startServerStream(
        callId: string,
        _baseUrl: string,
        method: string,
        _requestBase64: string,
        metadata: NativeMetadata,
        deadlineMs: number,
    ) {
        this.streams.push({ callId, method, metadata, deadlineMs });
    }

    cancel(callId: string) {
        this.cancelled.push(callId);
    }

    addListener(event: string, listener: Listener) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(listener);
        return { remove: () => this.listeners.get(event)!.delete(listener) };
    }

    emit(event: string, payload: unknown) {
        this.listeners.get(event)?.forEach((l) => l(payload));
    }

    listenerCount() {
        return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
    }
}

const setup = () => {
    const bridge = new FakeBridge();
    const transport = new NativeGrpcTransport({ bridge, getBaseUrl: () => "https://api.test" });
    return { bridge, transport };
};

describe("NativeGrpcTransport unary", () => {
    it("sends the full method name, metadata and deadline, and decodes the response", async () => {
        const { bridge, transport } = setup();
        const expected = GetPrivacyPolicyResponse.create({ id: "p1", version: "2.0.0" });
        bridge.unaryResult = Promise.resolve({
            status: 0,
            message: "",
            responseBase64: base64encode(GetPrivacyPolicyResponse.toBinary(expected)),
            headers: {},
            trailers: {},
        });

        const { response } = await new LegalServiceClient(transport).getPrivacyPolicy(
            {},
            { meta: { authorization: "Bearer t" }, timeout: 15000 },
        );

        expect(response).toEqual(expected);
        expect(bridge.unaryCalls[0]).toMatchObject({
            baseUrl: "https://api.test",
            method: "senswave.users.v1.LegalService/GetPrivacyPolicy",
            requestBase64: "",
            metadata: { authorization: ["Bearer t"] },
            deadlineMs: 15000,
        });
    });

    it("uses no deadline when no timeout is given", async () => {
        const { bridge, transport } = setup();

        await new LegalServiceClient(transport).getPrivacyPolicy({});

        expect(bridge.unaryCalls[0].deadlineMs).toBe(0);
    });

    it("rejects with a named RpcError carrying trailers", async () => {
        const { bridge, transport } = setup();
        bridge.unaryResult = Promise.resolve({
            status: 7,
            message: "User does not have latest consents.",
            responseBase64: null,
            headers: {},
            trailers: { "senswave-trace-id": ["trace-1"] },
        });

        const error = await new LegalServiceClient(transport).getPrivacyPolicy({}).then(
            () => null,
            (e) => e,
        );

        expect(error).toBeInstanceOf(RpcError);
        expect(error.code).toBe("PERMISSION_DENIED");
        expect(error.message).toBe("User does not have latest consents.");
        expect(error.meta).toEqual({ "senswave-trace-id": "trace-1" });
        expect(error.serviceName).toBe("senswave.users.v1.LegalService");
        expect(error.methodName).toBe("GetPrivacyPolicy");
    });

    it("maps a bridge failure to UNAVAILABLE", async () => {
        const { bridge, transport } = setup();
        bridge.unaryResult = Promise.reject(new Error("bridge down"));

        const error = await new LegalServiceClient(transport).getPrivacyPolicy({}).then(
            () => null,
            (e) => e,
        );

        expect(error.code).toBe("UNAVAILABLE");
    });

    it("cancels the native call on abort", async () => {
        const { bridge, transport } = setup();
        bridge.unaryResult = new Promise(() => {});
        const abort = new AbortController();

        new LegalServiceClient(transport).getPrivacyPolicy({}, { abort: abort.signal });
        abort.abort();

        expect(bridge.cancelled).toEqual([bridge.unaryCalls[0].callId]);
    });
});

describe("NativeGrpcTransport server streaming", () => {
    const encode = (message: LiveUpdate) => base64encode(LiveUpdate.toBinary(message));

    it("delivers messages in order and completes on OK", async () => {
        const { bridge, transport } = setup();
        const call = new LiveUpdatesServiceClient(transport).subscribe({ homeReferenceId: "h1" });
        const { callId, method, deadlineMs } = bridge.streams[0];

        expect(method).toBe("senswave.liveupdates.v1.LiveUpdatesService/Subscribe");
        expect(deadlineMs).toBe(0);

        const first = LiveUpdate.create({ update: { oneofKind: "initialized", initialized: {} } });
        const second = LiveUpdate.create({
            update: { oneofKind: "deviceTile", deviceTile: { deviceId: "d1" } },
        });

        bridge.emit("onStreamHeaders", { callId, headers: {} });
        bridge.emit("onStreamMessage", { callId: "other", base64: encode(second) });
        bridge.emit("onStreamMessage", { callId, base64: encode(first) });
        bridge.emit("onStreamMessage", { callId, base64: encode(second) });
        bridge.emit("onStreamClose", { callId, status: 0, message: "", headers: {}, trailers: {} });

        const received: LiveUpdate[] = [];
        for await (const message of call.responses) received.push(message);

        expect(received).toEqual([first, second]);
        expect((await call.status).code).toBe("OK");
        expect(bridge.listenerCount()).toBe(0);
    });

    it("errors the stream on a non-OK close", async () => {
        const { bridge, transport } = setup();
        const call = new LiveUpdatesServiceClient(transport).subscribe({ homeReferenceId: "h1" });
        const { callId } = bridge.streams[0];

        bridge.emit("onStreamClose", {
            callId,
            status: 7,
            message: "denied",
            headers: {},
            trailers: {},
        });

        const error = await (async () => {
            for await (const _ of call.responses) {
                // drain
            }
        })().then(
            () => null,
            (e) => e,
        );

        expect(error.code).toBe("PERMISSION_DENIED");
        expect(bridge.listenerCount()).toBe(0);
    });

    it("cancels the native stream on abort", () => {
        const { bridge, transport } = setup();
        const abort = new AbortController();

        new LiveUpdatesServiceClient(transport).subscribe(
            { homeReferenceId: "h1" },
            { abort: abort.signal },
        );
        abort.abort();

        expect(bridge.cancelled).toEqual([bridge.streams[0].callId]);
    });
});
