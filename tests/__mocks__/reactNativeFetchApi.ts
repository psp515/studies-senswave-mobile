// Jest runs on node, which already ships fetch and streams; never load the RN networking stack.
export const fetch = globalThis.fetch;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
