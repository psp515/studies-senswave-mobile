import type { Interceptor } from "@connectrpc/connect";
import { createAuthInterceptor, type AuthInterceptorDeps } from "./authInterceptor";
import { createErrorInterceptor } from "./errorInterceptor";
import { createLegalInterceptor, type LegalInterceptorDeps } from "./legalInterceptor";

export type InterceptorDeps = AuthInterceptorDeps & LegalInterceptorDeps;

/** Outer → inner: auth, legal, errors. */
export const createInterceptors = (deps: InterceptorDeps): Interceptor[] => [
    createAuthInterceptor(deps),
    createLegalInterceptor(deps),
    createErrorInterceptor(),
];

export { createAuthInterceptor, createLegalInterceptor, createErrorInterceptor };
export type { AuthInterceptorDeps, LegalInterceptorDeps };
