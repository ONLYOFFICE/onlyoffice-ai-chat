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
      const result = callRoute(
        config,
        "ai",
        "send",
        [] as never,
        engines
      );
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
        json: () => Promise.resolve({ ok: true }),
      });
      const cfg: ServerAPIConfig = {
        ...config,
        headers: { Authorization: "Bearer t" },
      };
      const res = await callRoute(
        cfg,
        "ai",
        "send",
        [{ q: "hi" }] as never
      );
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
        json: () => Promise.resolve(null),
      });
      await callRoute(
        config,
        "threads",
        "appendUserMessage",
        ["t1", { role: "user" }, "p1"] as never
      );
      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toBe(
        JSON.stringify(["t1", { role: "user" }, "p1"])
      );
    });

    it("omits body for GET routes (no body, no Content-Type)", async () => {
      fetchMock.mockResolvedValue({
        json: () => Promise.resolve([]),
      });
      await callRoute(
        config,
        "threads",
        "list",
        [] as never
      );
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.example.com/v1/threads/list");
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    });

    it("forwards headers on GET requests when configured", async () => {
      fetchMock.mockResolvedValue({
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
});
