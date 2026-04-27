import type { RouteSpec } from "../../../core/services";
import type {
  ServerAPIConfig,
  ServerAPIEngines,
  ServerAPIRoutes,
} from "./index";

type ServiceKey = keyof ServerAPIRoutes;

type EngineMethod<
  S extends ServiceKey,
  K extends keyof ServerAPIEngines[S],
> = ServerAPIEngines[S][K] extends (...args: never) => unknown
  ? ServerAPIEngines[S][K]
  : never;

/**
 * Dispatch a service-method call. If `origin` and `baseUrl` are set,
 * issue a `fetch` against the route declared for `service.method`
 * (HTTP method + path come from the route entry). Otherwise call the
 * engine method on the corresponding service instance directly.
 *
 * The remote-fetch branch always returns parsed JSON cast to the
 * engine's return type — streaming methods will need real streaming
 * support before they round-trip correctly.
 */
export function callRoute<
  S extends ServiceKey,
  K extends keyof ServerAPIEngines[S] & keyof ServerAPIRoutes[S] & string,
>(
  config: ServerAPIConfig,
  service: S,
  method: K,
  args: Parameters<EngineMethod<S, K>>,
  engines?: ServerAPIEngines
): ReturnType<EngineMethod<S, K>> {
  if ((!config.origin || !config.baseUrl) && engines) {
    const engine = engines[service];
    const fn = engine[method] as (...a: unknown[]) => unknown;
    return fn.apply(engine, args) as ReturnType<EngineMethod<S, K>>;
  }

  const route = (config.routes[service] as Record<string, RouteSpec>)[method];
  const url = `${config.origin}${config.baseUrl}/${route.path}`;
  const init: RequestInit = { method: route.method };
  const allowsBody = route.method !== "GET";
  if (allowsBody && args.length > 0) {
    init.headers = { "Content-Type": "application/json", ...config.headers };
    init.body = JSON.stringify(args.length === 1 ? args[0] : args);
  } else if (config.headers) {
    init.headers = { ...config.headers };
  }
  return fetch(url, init).then((res) => res.json()) as ReturnType<
    EngineMethod<S, K>
  >;
}
