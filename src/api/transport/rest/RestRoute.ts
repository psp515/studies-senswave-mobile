import type {
    DescMessage,
    DescMethod,
    DescService,
    MessageInitShape,
    MessageShape,
} from "@bufbuild/protobuf";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RestRoute<I extends DescMessage, O extends DescMessage> {
    method: HttpMethod;
    /** Path relative to `/api/`, without leading slash. Query string included when needed. */
    path: (req: MessageShape<I>) => string;
    /** JSON body. Omit for GET / DELETE or when the endpoint takes no body. */
    body?: (req: MessageShape<I>) => unknown;
    /** Converts the parsed JSON body (undefined when empty) into the response message. */
    response: (json: unknown, status: number) => MessageInitShape<O>;
}

export type RestRouteTable<S extends DescService> = {
    [K in keyof S["method"]]: RestRoute<S["method"][K]["input"], S["method"][K]["output"]>;
};

export interface RestRouteRegistryEntry {
    key: string;
    route: RestRoute<DescMessage, DescMessage>;
}

export const routeKey = (method: DescMethod): string => `${method.parent.typeName}/${method.name}`;

/** Binds a route table to its service so every RPC must have a row (TypeScript enforces completeness). */
export const defineRoutes = <S extends DescService>(
    service: S,
    routes: RestRouteTable<S>,
): RestRouteRegistryEntry[] =>
    service.methods.map((m) => ({
        key: routeKey(m),
        route: routes[m.localName as keyof S["method"]] as RestRoute<DescMessage, DescMessage>,
    }));
