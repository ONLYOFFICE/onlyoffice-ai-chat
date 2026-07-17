import type { RouteSpec } from "../../../core/services";
import { isAbortError } from "../../../shared/abort";
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
    "sendWithStreamOpenAI",
    "regenerateStream",
    "approveToolCall",
    "denyToolCall",
  ]),
};

function isStreamingRoute(service: ServiceKey, method: string): boolean {
  return STREAMING_METHODS[service]?.has(method) ?? false;
}

/**
 * Pull the caller's `AbortSignal` out of a payload's `actionArgs` so it
 * can be wired onto the `fetch` itself, and return a copy of `args` with
 * the signal stripped from the payload — an `AbortSignal` JSON-stringifies
 * to `{}`, and the only cancellation the server can observe is the client
 * closing the connection.
 */
function extractAbortSignal(args: readonly unknown[]): {
  signal: AbortSignal | undefined;
  args: readonly unknown[];
} {
  const [input, ...rest] = args;
  if (input === null || typeof input !== "object") {
    return { signal: undefined, args };
  }
  const actionArgs = (input as { actionArgs?: unknown }).actionArgs;
  if (actionArgs === null || typeof actionArgs !== "object") {
    return { signal: undefined, args };
  }
  const signal = (actionArgs as { signal?: unknown }).signal;
  if (!(signal instanceof AbortSignal)) {
    return { signal: undefined, args };
  }
  const stripped: Record<string, unknown> = {
    ...(actionArgs as Record<string, unknown>),
  };
  delete stripped.signal;
  return { signal, args: [{ ...input, actionArgs: stripped }, ...rest] };
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
    // Tear down the connection when the consumer exits early (break or
    // abort) — releasing the lock alone would leave the body stream open.
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Issue the fetch eagerly so cancellation/abort signals propagate, but
 * defer the `await` until the consumer pulls the first event. Non-2xx
 * responses surface as an error thrown from the first iteration. An
 * abort via `init.signal` (Stop pressed) is a graceful end of stream,
 * not a stream error.
 */
function streamRoute(url: string, init: RequestInit): AsyncIterable<unknown> {
  const responsePromise = fetch(url, init);
  // The eager fetch may reject (e.g. on abort) before the consumer starts
  // iterating — attach a no-op handler so it never surfaces as an
  // unhandled rejection; the iterator below still awaits the original.
  void responsePromise.catch(() => undefined);
  const aborted = (error: unknown) =>
    isAbortError(error, init.signal ?? undefined);
  return {
    async *[Symbol.asyncIterator]() {
      let res: Response;
      try {
        res = await responsePromise;
      } catch (error) {
        if (aborted(error)) return;
        throw error;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Streaming route ${url} failed: ${res.status} ${res.statusText}` +
            (text ? ` — ${text}` : "")
        );
      }
      try {
        yield* readNdjson(res);
      } catch (error) {
        if (aborted(error)) return;
        throw error;
      }
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
  // The caller's AbortSignal rides on the request itself — closing the
  // connection is the only cancellation the server can observe.
  const { signal, args: bodyArgs } = extractAbortSignal(args);
  const init: RequestInit = { method: route.method };
  if (signal) init.signal = signal;
  const allowsBody = route.method !== "GET";
  if (allowsBody && bodyArgs.length > 0) {
    init.headers = { "Content-Type": "application/json", ...config.headers };
    init.body = JSON.stringify(bodyArgs.length === 1 ? bodyArgs[0] : bodyArgs);
  } else {
    if (route.method === "GET" && route.params && bodyArgs.length > 0) {
      const qs = new URLSearchParams();
      route.params.forEach((name, i) => {
        const value = bodyArgs[i];
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

  return fetch(url, init).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }) as ReturnType<EngineMethod<S, K>>;
}
