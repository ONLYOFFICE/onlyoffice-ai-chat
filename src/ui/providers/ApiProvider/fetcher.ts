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
 * Methods that return an `AsyncIterable` of typed events. The remote
 * branch reads these as NDJSON instead of buffering the whole response
 * with `res.json()`.
 */
const STREAMING_METHODS: Partial<Record<ServiceKey, ReadonlySet<string>>> = {
  ai: new Set([
    "sendWithStream",
    "regenerateStream",
    "approveToolCall",
    "denyToolCall",
  ]),
};

function isStreamingRoute(service: ServiceKey, method: string): boolean {
  return STREAMING_METHODS[service]?.has(method) ?? false;
}

/**
 * Consume a `Response` body as newline-delimited JSON: one event per
 * line, separated by `\n`. Buffers partial reads across chunk boundaries
 * and yields a final unterminated event if the stream closes without a
 * trailing newline.
 */
async function* readNdjson(res: Response): AsyncIterable<unknown> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Response has no readable body");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        yield JSON.parse(trimmed);
      }
    }
    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail.length > 0) {
      yield JSON.parse(tail);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Issue the fetch eagerly so cancellation/abort signals propagate, but
 * defer the `await` until the consumer pulls the first event. Non-2xx
 * responses surface as an error thrown from the first iteration.
 */
function streamRoute(url: string, init: RequestInit): AsyncIterable<unknown> {
  const responsePromise = fetch(url, init);
  return {
    async *[Symbol.asyncIterator]() {
      const res = await responsePromise;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Streaming route ${url} failed: ${res.status} ${res.statusText}` +
            (text ? ` — ${text}` : "")
        );
      }
      yield* readNdjson(res);
    },
  };
}

/**
 * Dispatch a service-method call. If `origin` and `baseUrl` are set,
 * issue a `fetch` against the route declared for `service.method`
 * (HTTP method + path come from the route entry). Otherwise call the
 * engine method on the corresponding service instance directly.
 *
 * Non-streaming routes return `Promise<parsed-JSON>`. Streaming routes
 * (see {@link STREAMING_METHODS}) return an `AsyncIterable<event>`
 * backed by an NDJSON response body — one JSON event per line,
 * `Content-Type: application/x-ndjson`.
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
  let url = `${config.origin}${config.baseUrl}/${route.path}`;
  const init: RequestInit = { method: route.method };
  const allowsBody = route.method !== "GET";
  if (allowsBody && args.length > 0) {
    init.headers = { "Content-Type": "application/json", ...config.headers };
    init.body = JSON.stringify(args.length === 1 ? args[0] : args);
  } else {
    if (route.method === "GET" && route.params && args.length > 0) {
      const qs = new URLSearchParams();
      route.params.forEach((name, i) => {
        const value = args[i];
        if (value === undefined || value === null) return;
        if (typeof value === "string" && value === "") return;
        qs.set(name, typeof value === "string" ? value : JSON.stringify(value));
      });
      const q = qs.toString();
      if (q) url += `?${q}`;
    }
    if (config.headers) init.headers = { ...config.headers };
  }

  if (isStreamingRoute(service, method)) {
    return streamRoute(url, init) as unknown as ReturnType<EngineMethod<S, K>>;
  }

  return fetch(url, init).then((res) => res.json()) as ReturnType<
    EngineMethod<S, K>
  >;
}
