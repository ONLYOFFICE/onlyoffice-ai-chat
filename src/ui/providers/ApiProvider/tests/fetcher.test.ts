import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callRoute } from "../fetcher";
import {
  DEFAULT_SERVER_API_ROUTES,
  type ServerAPIConfig,
  type ServerAPIEngines,
} from "../index";

const baseRoutes = DEFAULT_SERVER_API_ROUTES;

function makeEngines() {
  const stub = {
    ai: {
      send: vi.fn().mockResolvedValue("send-engine"),
      sendCustom: vi.fn().mockResolvedValue("custom-engine"),
      sendWithStream: vi.fn().mockResolvedValue("stream-engine"),
    },
    preferences: {
      getDeepMode: vi.fn().mockResolvedValue("deep"),
      setDeepMode: vi.fn().mockResolvedValue(undefined),
      clearDeepMode: vi.fn().mockResolvedValue(undefined),
      isDeepModeSet: vi.fn().mockResolvedValue(true),
    },
  };
  return stub as unknown as ServerAPIEngines & typeof stub;
}

describe("callRoute", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("engine fallback", () => {
    it("calls engine method when origin is empty and engines provided", async () => {
      const engines = makeEngines();
      const config: ServerAPIConfig = {
        origin: "",
        baseUrl: "/api",
        routes: baseRoutes,
      };
      const result = await callRoute(
        config,
        "ai",
        "send",
        [{ foo: 1 }] as never,
        engines
      );
      expect(result).toBe("send-engine");
      expect(engines.ai.send).toHaveBeenCalledWith({ foo: 1 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("calls engine method when baseUrl is empty and engines provided", async () => {
      const engines = makeEngines();
      const config: ServerAPIConfig = {
        origin: "https://api.example.com",
        baseUrl: "",
        routes: baseRoutes,
      };
      const result = await callRoute(
        config,
        "preferences",
        "getDeepMode",
        [] as never,
        engines
      );
      expect(result).toBe("deep");
      expect(engines.preferences.getDeepMode).toHaveBeenCalledWith();
    });

    it("preserves engine `this` binding via apply", () => {
      const engine = {
        marker: "ok",
        send(): string {
          return this.marker;
        },
      };
      const engines = { ai: engine } as never;
      const config: ServerAPIConfig = {
        origin: "",
        baseUrl: "",
        routes: baseRoutes,
      };
      const result = callRoute(config, "ai", "send", [] as never, engines);
      expect(result).toBe("ok");
    });
  });

  describe("remote fetch", () => {
    const config: ServerAPIConfig = {
      origin: "https://api.example.com",
      baseUrl: "/v1",
      routes: baseRoutes,
    };

    it("issues POST with single-arg JSON body and merged headers", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });
      const cfg: ServerAPIConfig = {
        ...config,
        headers: { Authorization: "Bearer t" },
      };
      const res = await callRoute(cfg, "ai", "send", [{ q: "hi" }] as never);
      expect(res).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.example.com/v1/ai/send");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer t",
      });
      expect(init.body).toBe(JSON.stringify({ q: "hi" }));
    });

    it("serializes multi-arg payloads as an array", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      });
      await callRoute(config, "threads", "appendUserMessage", [
        "t1",
        { role: "user" },
        "p1",
      ] as never);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toBe(JSON.stringify(["t1", { role: "user" }, "p1"]));
    });

    it("omits body for GET routes (no body, no Content-Type)", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      await callRoute(config, "threads", "list", [] as never);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.example.com/v1/threads/list");
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    });

    it("serializes an object cursor into the GET query as JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      const cursor = { lastEditDate: 123, threadId: "t9" };
      await callRoute(config, "threads", "list", ["e1", 100, cursor] as never);
      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url as string);
      expect(parsed.pathname).toBe("/v1/threads/list");
      expect(parsed.searchParams.get("entityId")).toBe("e1");
      expect(parsed.searchParams.get("count")).toBe("100");
      expect(JSON.parse(parsed.searchParams.get("cursor")!)).toEqual(cursor);
    });

    it("omits undefined pagination params from the GET query", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      await callRoute(config, "threads", "list", [
        "e1",
        undefined,
        undefined,
      ] as never);
      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url as string);
      expect(parsed.searchParams.get("entityId")).toBe("e1");
      expect(parsed.searchParams.has("count")).toBe(false);
      expect(parsed.searchParams.has("cursor")).toBe(false);
    });

    it("forwards headers on GET requests when configured", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      const cfg: ServerAPIConfig = {
        ...config,
        headers: { "X-Trace": "abc" },
      };
      await callRoute(cfg, "threads", "list", [] as never);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toEqual({ "X-Trace": "abc" });
      expect(init.body).toBeUndefined();
    });

    it("does not set body or headers on POST with empty args", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      });
      // Override webSearch.isConfigured to POST so we exercise the
      // "allowsBody && args.length === 0" branch.
      const cfg: ServerAPIConfig = {
        ...config,
        routes: {
          ...config.routes,
          webSearch: {
            ...config.routes.webSearch,
            isConfigured: { method: "POST", path: "web-search/is-configured" },
          },
        },
      };
      await callRoute(cfg, "webSearch", "isConfigured", [] as never);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    });

    it("falls back to remote even when engines provided if origin+baseUrl set", async () => {
      const engines = makeEngines();
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve("remote"),
      });
      const res = await callRoute(
        config,
        "ai",
        "send",
        [{ q: 1 }] as never,
        engines
      );
      expect(res).toBe("remote");
      expect(engines.ai.send).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("streaming routes (NDJSON)", () => {
    const config: ServerAPIConfig = {
      origin: "https://api.example.com",
      baseUrl: "/v1",
      routes: baseRoutes,
    };

    function ndjsonResponse(
      chunks: string[],
      init: { ok?: boolean; status?: number; statusText?: string } = {}
    ): Response {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
      return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        statusText: init.statusText ?? "OK",
        body,
        text: () => Promise.resolve(""),
      } as unknown as Response;
    }

    async function collect(iter: AsyncIterable<unknown>): Promise<unknown[]> {
      const out: unknown[] = [];
      for await (const ev of iter) out.push(ev);
      return out;
    }

    it("yields parsed NDJSON events for sendWithStream", async () => {
      fetchMock.mockResolvedValue(
        ndjsonResponse([
          '{"type":"message-start","messageId":"m1"}\n',
          '{"type":"message-delta","messageId":"m1"}\n',
          '{"type":"message-end","messageId":"m1"}\n',
        ])
      );
      const stream = callRoute(config, "ai", "sendWithStream", [
        { userMessage: { role: "user" } },
      ] as never) as unknown as AsyncIterable<unknown>;
      const events = await collect(stream);
      expect(events).toEqual([
        { type: "message-start", messageId: "m1" },
        { type: "message-delta", messageId: "m1" },
        { type: "message-end", messageId: "m1" },
      ]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.example.com/v1/ai/send-with-stream");
      expect(init.method).toBe("POST");
    });

    it("buffers events split across read boundaries", async () => {
      // One JSON object split across two chunks; the newline arrives
      // in the second chunk along with the start of the next event.
      fetchMock.mockResolvedValue(
        ndjsonResponse([
          '{"type":"message-start","mes',
          'sageId":"m1"}\n{"type":"message-delta",',
          '"messageId":"m1"}\n',
        ])
      );
      const stream = callRoute(config, "ai", "regenerateStream", [
        { threadId: "t1" },
      ] as never) as unknown as AsyncIterable<unknown>;
      const events = await collect(stream);
      expect(events).toEqual([
        { type: "message-start", messageId: "m1" },
        { type: "message-delta", messageId: "m1" },
      ]);
    });

    it("yields the trailing event when the stream lacks a final newline", async () => {
      fetchMock.mockResolvedValue(
        ndjsonResponse([
          '{"type":"message-start","messageId":"m1"}\n',
          '{"type":"message-end","messageId":"m1"}',
        ])
      );
      const stream = callRoute(config, "ai", "sendWithStream", [
        {},
      ] as never) as unknown as AsyncIterable<unknown>;
      const events = await collect(stream);
      expect(events).toEqual([
        { type: "message-start", messageId: "m1" },
        { type: "message-end", messageId: "m1" },
      ]);
    });

    it("completes without yielding on an empty stream", async () => {
      fetchMock.mockResolvedValue(ndjsonResponse([]));
      const stream = callRoute(config, "ai", "approveToolCall", [
        {},
      ] as never) as unknown as AsyncIterable<unknown>;
      const events = await collect(stream);
      expect(events).toEqual([]);
    });

    it("ignores blank lines between events", async () => {
      fetchMock.mockResolvedValue(
        ndjsonResponse([
          '{"type":"message-start","messageId":"m1"}\n',
          "\n",
          '{"type":"message-end","messageId":"m1"}\n',
        ])
      );
      const stream = callRoute(config, "ai", "denyToolCall", [
        {},
      ] as never) as unknown as AsyncIterable<unknown>;
      const events = await collect(stream);
      expect(events).toHaveLength(2);
    });

    it("wires actionArgs.signal onto fetch and strips it from the body", async () => {
      fetchMock.mockResolvedValue(ndjsonResponse([]));
      const controller = new AbortController();
      const stream = callRoute(config, "ai", "sendWithStream", [
        {
          userMessage: { role: "user" },
          actionArgs: { isReasoning: true, signal: controller.signal },
        },
      ] as never) as unknown as AsyncIterable<unknown>;
      await collect(stream);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.signal).toBe(controller.signal);
      expect(JSON.parse(init.body)).toEqual({
        userMessage: { role: "user" },
        actionArgs: { isReasoning: true },
      });
    });

    it("ends gracefully when the fetch itself is aborted", async () => {
      const abortError = Object.assign(new Error("The user aborted."), {
        name: "AbortError",
      });
      fetchMock.mockRejectedValue(abortError);
      const controller = new AbortController();
      controller.abort();
      const stream = callRoute(config, "ai", "sendWithStream", [
        { actionArgs: { signal: controller.signal } },
      ] as never) as unknown as AsyncIterable<unknown>;
      await expect(collect(stream)).resolves.toEqual([]);
    });

    it("treats an AbortError from the body reader as end of stream", async () => {
      const encoder = new TextEncoder();
      const abortError = Object.assign(new Error("aborted"), {
        name: "AbortError",
      });
      let step = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (step === 0) {
            step = 1;
            controller.enqueue(
              encoder.encode('{"type":"message-start","messageId":"m1"}\n')
            );
          } else {
            controller.error(abortError);
          }
        },
      });
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        body,
        text: () => Promise.resolve(""),
      } as unknown as Response);
      const stream = callRoute(config, "ai", "sendWithStream", [
        {},
      ] as never) as unknown as AsyncIterable<unknown>;
      const events = await collect(stream);
      expect(events).toEqual([{ type: "message-start", messageId: "m1" }]);
    });

    it("still surfaces non-abort fetch failures", async () => {
      fetchMock.mockRejectedValue(new TypeError("network down"));
      const stream = callRoute(config, "ai", "sendWithStream", [
        {},
      ] as never) as unknown as AsyncIterable<unknown>;
      await expect(collect(stream)).rejects.toThrow("network down");
    });

    it("throws on first iteration for non-2xx responses", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        body: null,
        text: () => Promise.resolve("boom"),
      } as unknown as Response);
      const stream = callRoute(config, "ai", "sendWithStream", [
        {},
      ] as never) as unknown as AsyncIterable<unknown>;
      await expect(collect(stream)).rejects.toThrow(/500/);
    });

    it("non-streaming methods on the same service still parse as JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: true as const,
        json: () => Promise.resolve({ ok: true }),
      });
      const res = await callRoute(config, "ai", "send", [{ q: 1 }] as never);
      expect(res).toEqual({ ok: true });
    });
  });
});
