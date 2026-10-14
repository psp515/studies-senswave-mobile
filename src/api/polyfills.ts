import { polyfillGlobal } from "react-native/Libraries/Utilities/PolyfillFunctions";
import { ReadableStream } from "web-streams-polyfill";
import { fetch as expoFetch } from "expo/fetch";
import { TextDecoder, TextEncoder } from "text-encoding";

// Streaming fetch (gRPC-Web, server streams) needs ReadableStream / TextEncoder / TextDecoder,
// which Hermes lacks. Install only where missing.
if (typeof globalThis.ReadableStream === "undefined") {
    polyfillGlobal("ReadableStream", () => ReadableStream);
}
if (typeof globalThis.TextEncoder === "undefined") {
    polyfillGlobal("TextEncoder", () => TextEncoder);
}
if (typeof globalThis.TextDecoder === "undefined") {
    polyfillGlobal("TextDecoder", () => TextDecoder);
}

/** WinterCG fetch from Expo with native binary ReadableStream response bodies. */
export const streamingFetch: typeof globalThis.fetch =
    expoFetch as unknown as typeof globalThis.fetch;
