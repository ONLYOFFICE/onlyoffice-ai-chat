/** HTTP verbs supported by service-route declarations. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * One transport-bound entry of a {@link DEFAULT_AI_ROUTES}-style map.
 * Each engine method maps to a `{method, path}` pair so a remote API
 * can be reconfigured without re-touching the call sites.
 */
export type RouteSpec = {
  method: HttpMethod;
  path: string;
};
