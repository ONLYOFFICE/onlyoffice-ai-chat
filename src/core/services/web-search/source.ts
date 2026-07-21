import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";
import type { ProviderFetch } from "../../../shared/provider-credentials";
import type { StorageAdapter } from "../../storage";

/** Stable serverType prefix used in `storage.toolPrefs` and runtime routing. */
export const WEB_SEARCH_TYPE = "web-search";

/**
 * Ensure a trailing slash so `new URL(path, base)` keeps the full base
 * path: `new URL("search", "https://host/api")` would drop `/api`,
 * while `.../api/` + `search` resolves to `.../api/search`. Lets callers
 * pass the base URL with or without a trailing slash.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/** Abort a hung request instead of waiting on the provider indefinitely. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Total attempts (1 initial + retries) on transient network failures. */
const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 250;

async function fetchWithTimeout(
  doFetch: ProviderFetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await doFetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Issue a web-search request with a per-attempt timeout and a small
 * exponential backoff on transient failures (network error / timeout).
 * A non-ok HTTP response is *not* retried — it is returned as-is so
 * {@link formatResponse} can surface the status, matching prior behaviour.
 */
async function fetchWithRetry(
  doFetch: ProviderFetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchWithTimeout(doFetch, url, init);
    } catch (e) {
      lastError = e;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Built-in web-search tools.
 *
 * Available when {@link StorageAdapter.webSearch} carries a configured
 * provider (Exa, ONLYOFFICE, …). When no configuration is persisted,
 * returns an empty list — the model never sees the tools.
 *
 * Mirrors `src/ui/tools/sources/WebSearch.ts` but lives on the engine
 * side so the tool list is assembled in {@link buildToolContext}
 * without a round-trip to the UI's `Servers` aggregator.
 */
export async function getWebSearchTools(
  storage: StorageAdapter,
  entityId?: string
): Promise<TMCPItem[]> {
  const config = await storage.webSearch.read(entityId);
  if (!config) return [];

  return [
    {
      name: "web_search",
      description:
        "The search endpoint lets you intelligently search the web and extract contents from the results.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The query string for the search.",
          },
        },
      },
    },
    {
      name: "web_crawling",
      description:
        "Get the full page contents, summaries, and metadata for a list of URLs.",
      inputSchema: {
        type: "object",
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            description: "Array of URLs to crawl",
          },
        },
      },
    },
  ];
}

/**
 * Execute a web-search tool by `bareName` (`web_search` / `web_crawling`).
 * Returns a JSON-stringified payload — the same shape the UI's
 * `WebSearch.callTools` returns, so client-side display logic stays
 * unchanged.
 *
 * `fetchImpl` overrides the global `fetch` — wired to the host's
 * `PlatformAdapter.fetchProxy` when configured, otherwise omitted.
 */
export async function callWebSearchTool(
  storage: StorageAdapter,
  bareName: string,
  args: Record<string, unknown>,
  entityId?: string,
  fetchImpl?: ProviderFetch
): Promise<string> {
  const config = await storage.webSearch.read(entityId);
  if (!config) {
    return JSON.stringify({ error: "Web search is not configured." });
  }

  if (bareName === "web_search") {
    return webSearch(config, args, fetchImpl);
  }
  if (bareName === "web_crawling") {
    return webCrawling(config, args, fetchImpl);
  }
  return JSON.stringify({ error: `Unknown tool: ${bareName}` });
}

type WebSearchConfig = {
  provider: string;
  key?: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
  headers?: Record<string, string>;
};

async function webSearch(
  config: WebSearchConfig,
  args: Record<string, unknown>,
  fetchImpl?: ProviderFetch
): Promise<string> {
  const doFetch = fetchImpl ?? fetch;
  if (config.isCloudProvider || config.provider === "ONLYOFFICE") {
    try {
      const baseUrl =
        config.baseUrl || (config.isCloudProvider ? config.provider : "");
      const url = new URL("search", normalizeBaseUrl(baseUrl));
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
        ...config.headers,
      };
      const response = await fetchWithRetry(doFetch, url.href, {
        method: "POST",
        headers,
        body: JSON.stringify({
          engine: "exa",
          query: args.query,
          numResults: 5,
        }),
      });
      return await formatResponse(response);
    } catch (e) {
      logger.error("WebSearch error:", e);
      return JSON.stringify({ error: errorMessage(e) });
    }
  }
  if (config.provider === "Exa") {
    try {
      const response = await fetchWithRetry(doFetch, "https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.key ?? "",
        },
        body: JSON.stringify({
          query: args.query,
          text: true,
          numResults: 5,
          livecrawl: "preferred",
        }),
      });
      return await formatResponse(response);
    } catch (e) {
      logger.error("WebSearch error:", e);
      return JSON.stringify({ error: errorMessage(e) });
    }
  }
  return JSON.stringify(args);
}

async function webCrawling(
  config: WebSearchConfig,
  args: Record<string, unknown>,
  fetchImpl?: ProviderFetch
): Promise<string> {
  const doFetch = fetchImpl ?? fetch;
  if (config.isCloudProvider || config.provider === "ONLYOFFICE") {
    try {
      const baseUrl =
        config.baseUrl || (config.isCloudProvider ? config.provider : "");
      const url = new URL("contents", normalizeBaseUrl(baseUrl));
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
        ...config.headers,
      };
      const response = await fetchWithRetry(doFetch, url.href, {
        method: "POST",
        headers,
        body: JSON.stringify({ engine: "exa", urls: args.urls }),
      });
      return await formatResponse(response);
    } catch (e) {
      logger.error("WebSearch error:", e);
      return JSON.stringify({ error: errorMessage(e) });
    }
  }
  if (config.provider === "Exa") {
    try {
      const response = await fetchWithRetry(
        doFetch,
        "https://api.exa.ai/contents",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.key ?? "",
          },
          body: JSON.stringify({ urls: args.urls, text: true }),
        }
      );
      return await formatResponse(response);
    } catch (e) {
      logger.error("WebSearch error:", e);
      return JSON.stringify({ error: errorMessage(e) });
    }
  }
  return JSON.stringify(args);
}

async function formatResponse(response: Response): Promise<string> {
  if (!response.ok) {
    return JSON.stringify({
      error: response.status,
      message: `Network error: ${response.status}`,
    });
  }
  const parsed = await response.json();
  const data = parsed.error ? { error: parsed.error } : parsed.results;
  return JSON.stringify({ data });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
