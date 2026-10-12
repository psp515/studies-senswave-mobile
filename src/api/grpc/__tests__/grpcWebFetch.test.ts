import { RpcError } from "@protobuf-ts/runtime-rpc";
import { createGrpcWebFetch } from "@/api/grpc/grpcWebFetch";

const abortableHang = (_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
            const e = new Error("Aborted");
            e.name = "AbortError";
            reject(e);
        });
    });

describe("createGrpcWebFetch", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("passes the response through on success", async () => {
        const response = { ok: true } as Response;
        const base = jest.fn().mockResolvedValue(response);

        await expect(createGrpcWebFetch(base)("https://x/y", { method: "POST" })).resolves.toBe(
            response,
        );
    });

    it("maps a network failure to UNAVAILABLE", async () => {
        const base = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

        const error = await createGrpcWebFetch(base)("https://x/y", {}).catch((e) => e);

        expect(error).toBeInstanceOf(RpcError);
        expect(error.code).toBe("UNAVAILABLE");
        expect(error.message).toBe("Network request failed");
    });

    it("leaves RpcError untouched", async () => {
        const original = new RpcError("nope", "PERMISSION_DENIED");
        const base = jest.fn().mockRejectedValue(original);

        await expect(createGrpcWebFetch(base)("https://x/y", {})).rejects.toBe(original);
    });

    it("rejects with DEADLINE_EXCEEDED and aborts the request when grpc-timeout elapses", async () => {
        jest.useFakeTimers();
        let signal: AbortSignal | undefined;
        const base = jest.fn((url: unknown, init?: RequestInit) => {
            signal = init?.signal ?? undefined;
            return abortableHang(url, init);
        });

        const promise = createGrpcWebFetch(base as unknown as typeof fetch)("https://x/y", {
            headers: { "grpc-timeout": "50m" },
        }).catch((e) => e);
        jest.advanceTimersByTime(50);
        const error = await promise;

        expect(error).toBeInstanceOf(RpcError);
        expect(error.code).toBe("DEADLINE_EXCEEDED");
        expect(signal?.aborted).toBe(true);
    });

    it("reads grpc-timeout from a Headers-like object and supports all units", async () => {
        jest.useFakeTimers();
        const cases: [string, number][] = [
            ["2S", 2000],
            ["1M", 60000],
            ["1H", 3600000],
            ["5000000u", 5000],
            ["7000000n", 7],
        ];

        for (const [value, ms] of cases) {
            const headers = { get: (k: string) => (k === "grpc-timeout" ? value : null) };
            const promise = createGrpcWebFetch(abortableHang as unknown as typeof fetch)(
                "https://x/y",
                { headers: headers as unknown as HeadersInit },
            ).catch((e) => e);
            jest.advanceTimersByTime(ms - 1);
            let settled = false;
            promise.then(() => (settled = true));
            await Promise.resolve();
            expect(settled).toBe(false);
            jest.advanceTimersByTime(1);
            expect((await promise).code).toBe("DEADLINE_EXCEEDED");
        }
    });

    it("propagates a caller abort as-is", async () => {
        const controller = new AbortController();
        const promise = createGrpcWebFetch(abortableHang as unknown as typeof fetch)(
            "https://x/y",
            {
                headers: { "grpc-timeout": "60000m" },
                signal: controller.signal,
            },
        ).catch((e) => e);
        controller.abort();
        const error = await promise;

        expect(error).not.toBeInstanceOf(RpcError);
        expect(error.name).toBe("AbortError");
    });

    it("starts no timer without a grpc-timeout header", async () => {
        jest.useFakeTimers();
        const base = jest.fn().mockResolvedValue({} as Response);

        await createGrpcWebFetch(base)("https://x/y", { method: "POST" });

        expect(jest.getTimerCount()).toBe(0);
        expect(base).toHaveBeenCalledWith("https://x/y", { method: "POST" });
    });

    it("clears the timer once headers arrive", async () => {
        jest.useFakeTimers();
        const base = jest.fn().mockResolvedValue({} as Response);

        await createGrpcWebFetch(base)("https://x/y", { headers: { "grpc-timeout": "50m" } });

        expect(jest.getTimerCount()).toBe(0);
    });
});
