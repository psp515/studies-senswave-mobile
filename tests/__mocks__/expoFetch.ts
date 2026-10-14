// expo/fetch needs native modules; node already ships a streaming fetch.
export const fetch = globalThis.fetch;
