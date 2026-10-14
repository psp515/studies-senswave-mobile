import type { TransportMode } from "./TransportMode";

export interface TransportIdentity {
    baseUrl: string;
    mode: TransportMode;
}

/** A session is bound to a backend and transport: logout when either changes (never on first mount). */
export const shouldLogoutOnChange = (
    prev: TransportIdentity | null,
    next: TransportIdentity,
): boolean => prev !== null && (prev.baseUrl !== next.baseUrl || prev.mode !== next.mode);
