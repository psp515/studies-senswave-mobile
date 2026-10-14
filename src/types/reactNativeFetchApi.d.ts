declare module "react-native-fetch-api" {
    export const fetch: (resource: unknown, options?: unknown) => Promise<Response>;
    export const Headers: typeof globalThis.Headers;
    export const Request: typeof globalThis.Request;
    export const Response: typeof globalThis.Response;
}

declare module "react-native/Libraries/Utilities/PolyfillFunctions" {
    export function polyfillGlobal<T>(name: string, getValue: () => T): void;
}
