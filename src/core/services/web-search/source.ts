import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";
import type { StorageAdapter } from "../../storage";

/** Stable serverType prefix used in `storage.toolPrefs` and runtime routing. */
export const WEB_SEARCH_TYPE = "web-search";

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
  storage: StorageAdapter
): Promise<TMCPItem[]> {
  const config = await storage.webSearch.read();
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
 */
export async function callWebSearchTool(
  storage: StorageAdapter,
  bareName: string,
  args: Record<string, unknown>
): Promise<string> {
  const config = await storage.webSearch.read();
  if (!config) {
    return JSON.stringify({ error: "Web search is not configured." });
  }

  if (bareName === "web_search") {
    return webSearch(config, args);
  }
  if (bareName === "web_crawling") {
    return webCrawling(config, args);
  }
  return JSON.stringify({ error: `Unknown tool: ${bareName}` });
}

type WebSearchConfig = {
  provider: string;
  key?: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
};

async function webSearch(
  config: WebSearchConfig,
  args: Record<string, unknown>
): Promise<string> {
  if (config.isCloudProvider || config.provider === "ONLYOFFICE") {
    try {
      const baseUrl =
        config.baseUrl || (config.isCloudProvider ? config.provider : "");
      const url = new URL("/api/2.0/ai/web-search/v1/search", baseUrl);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.key) headers.Authorization = `Bearer ${config.key}`;
      const response = await fetch(url.href, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: args.query, numResults: 5 }),
      });
      return await formatResponse(response);
    } catch (e) {
      logger.error("WebSearch error:", e);
      return JSON.stringify({ error: errorMessage(e) });
    }
  }
  if (config.provider === "Exa") {
    try {
      const response = await fetch("https://api.exa.ai/search", {
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
  args: Record<string, unknown>
): Promise<string> {
  if (config.isCloudProvider || config.provider === "ONLYOFFICE") {
    try {
      const baseUrl =
        config.baseUrl || (config.isCloudProvider ? config.provider : "");
      const url = new URL("/api/2.0/ai/web-search/v1/contents", baseUrl);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.key) headers.Authorization = `Bearer ${config.key}`;
      const response = await fetch(url.href, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: (args.urls as string[])[0] }),
      });
      return await formatResponse(response);
    } catch (e) {
      logger.error("WebSearch error:", e);
      return JSON.stringify({ error: errorMessage(e) });
    }
  }
  if (config.provider === "Exa") {
    try {
      const response = await fetch("https://api.exa.ai/contents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.key ?? "",
        },
        body: JSON.stringify({ urls: args.urls, text: true }),
      });
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
