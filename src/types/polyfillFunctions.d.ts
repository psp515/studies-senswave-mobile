declare module "react-native/Libraries/Utilities/PolyfillFunctions" {
    export function polyfillGlobal<T>(name: string, getValue: () => T): void;
}
