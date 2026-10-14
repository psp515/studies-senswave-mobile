import { polyfillGlobal } from "react-native/Libraries/Utilities/PolyfillFunctions";
import { ReadableStream } from "web-streams-polyfill";
import { fetch as rnFetch } from "react-native-fetch-api";
import { TextDecoder, TextEncoder } from "text-encoding";

// Streaming fetch (gRPC-Web, server streams) needs ReadableStream / TextEncoder / TextDecoder,
// which Hermes lacks. Install only where missing. They are read at call time by
// react-native-fetch-api, so installing them after its import is fine.
if (typeof globalThis.ReadableStream === "undefined") {
    polyfillGlobal("ReadableStream", () => ReadableStream);
}
if (typeof globalThis.TextEncoder === "undefined") {
    polyfillGlobal("TextEncoder", () => TextEncoder);
}
if (typeof globalThis.TextDecoder === "undefined") {
    polyfillGlobal("TextDecoder", () => TextDecoder);
}

/** fetch with incremental response body (React Native text streaming). */
export const streamingFetch: typeof globalThis.fetch = (input, init) =>
    rnFetch(input, { ...init, reactNative: { textStreaming: true } });
