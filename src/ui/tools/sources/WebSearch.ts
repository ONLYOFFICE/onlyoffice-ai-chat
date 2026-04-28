import type { CallbacksManager, ChatEventBus } from "../../events";
import logger from "../../../shared/logger";
import type { PlatformAdapter } from "../../platform/types";
import type { SettingsAdapter } from "../../../shared/settings-adapter";
import type { TMCPItem } from "../../../types";

const WEB_SEARCH_DATA = "webSearchProviderData";

export type WebSearchData = {
  provider: string;
  key: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
} | null;

class WebSearch {
  private tools: TMCPItem[];

  private webSearchData: WebSearchData = null;

  private settings: SettingsAdapter;
  private platform: PlatformAdapter;
  private eventBus: ChatEventBus;
  private callbacksManager: CallbacksManager | null;

  constructor(
    settings: SettingsAdapter,
    platform: PlatformAdapter,
    eventBus: ChatEventBus,
    callbacksManager: CallbacksManager | null = null
  ) {
    this.settings = settings;
    this.platform = platform;
    this.eventBus = eventBus;
    this.callbacksManager = callbacksManager;
    this.tools = [];

    const data = this.settings.get(WEB_SEARCH_DATA);

    if (data) {
      try {
        this.webSearchData = JSON.parse(data);
      } catch {
        this.webSearchData = null;
      }
    } else {
      this.webSearchData = null;
    }

    this.initTools();
  }

  /** Use platform fetchProxy if available, otherwise standard fetch */
  private platformFetch = (
    url: string,
    init?: RequestInit
  ): Promise<Response> => {
    const proxy = this.platform.fetchProxy;
    return proxy ? proxy(url, init) : fetch(url, init);
  };

  setWebSearchData = (data: WebSearchData) => {
    const changed =
      JSON.stringify(this.webSearchData) !== JSON.stringify(data);
    this.webSearchData = data;
    if (data) {
      this.settings.set(WEB_SEARCH_DATA, JSON.stringify(data));
    } else {
      this.settings.remove(WEB_SEARCH_DATA);
    }
    this.initTools();
    this.eventBus.emit("web-search-changed");
    if (changed) {
      this.callbacksManager?.emit("onWebSearchUpdated", {
        enabled: !!data,
        provider: data?.provider ?? null,
        isCloudProvider: data?.isCloudProvider,
      });
    }
  };

  /**
   * Re-read web search configuration from storage and rebuild tools.
   * Useful when the host updates settings externally.
   *
   * Emits `onWebSearchUpdated` only when the reloaded value differs from
   * the current one — a no-op re-read must not look like a user action to
   * host callbacks, matching the behaviour of `reloadExtendedThinking`.
   */
  reload = () => {
    const raw = this.settings.get(WEB_SEARCH_DATA);
    let next: WebSearchData = null;
    if (raw) {
      try {
        next = JSON.parse(raw);
      } catch {
        next = null;
      }
    }
    const changed =
      JSON.stringify(this.webSearchData) !== JSON.stringify(next);
    this.webSearchData = next;
    this.initTools();
    this.eventBus.emit("web-search-changed");
    if (changed) {
      this.callbacksManager?.emit("onWebSearchUpdated", {
        enabled: !!this.webSearchData,
        provider: this.webSearchData?.provider ?? null,
        isCloudProvider: this.webSearchData?.isCloudProvider,
      });
    }
  };

  getWebSearchData = () => {
    return this.webSearchData;
  };

  setTools = (tools: TMCPItem[]) => {
    this.tools = tools;
  };

  getTools = () => {
    return [...this.tools];
  };

  webSearch = async (args: Record<string, unknown>) => {
    if (
      this.webSearchData?.isCloudProvider ||
      this.webSearchData?.provider === "ONLYOFFICE"
    ) {
      try {
        const baseUrl =
          this.webSearchData.baseUrl ||
          (this.webSearchData.isCloudProvider
            ? this.webSearchData.provider
            : "");
        const searchUrl = new URL("/api/2.0/ai/web-search/v1/search", baseUrl);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (this.webSearchData.key) {
          headers.Authorization = `Bearer ${this.webSearchData.key}`;
        }
        const response = await fetch(`${searchUrl.href}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ query: args.query, numResults: 5 }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        logger.error("WebSearch error:", e);
        return JSON.stringify({ error: e });
      }
    }
    if (this.webSearchData?.provider === "Exa") {
      try {
        const response = await this.platformFetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.webSearchData?.key ?? "",
          },
          body: JSON.stringify({
            query: args.query,
            text: true,
            numResults: 5,
            livecrawl: "preferred",
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        logger.error("WebSearch error:", e);
        return JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return JSON.stringify(args);
  };

  webCrawling = async (args: Record<string, unknown>) => {
    if (
      this.webSearchData?.isCloudProvider ||
      this.webSearchData?.provider === "ONLYOFFICE"
    ) {
      try {
        const baseUrl =
          this.webSearchData.baseUrl ||
          (this.webSearchData.isCloudProvider
            ? this.webSearchData.provider
            : "");
        const crawlUrl = new URL("/api/2.0/ai/web-search/v1/contents", baseUrl);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (this.webSearchData.key) {
          headers.Authorization = `Bearer ${this.webSearchData.key}`;
        }
        const response = await fetch(`${crawlUrl.href}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: (args.urls as string[])[0],
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        logger.error(e);
        return JSON.stringify({ error: e });
      }
    }
    if (this.webSearchData?.provider === "Exa") {
      try {
        const response = await this.platformFetch(
          "https://api.exa.ai/contents",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.webSearchData?.key ?? "",
            },
            body: JSON.stringify({
              urls: args.urls,
              text: true,
            }),
          }
        );

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        logger.error(e);
        return JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return JSON.stringify(args);
  };

  callTools = async (name: string, args: Record<string, unknown>) => {
    if (name === "web_search") {
      return await this.webSearch(args);
    }

    if (name === "web_crawling") {
      return await this.webCrawling(args);
    }
  };

  initTools = () => {
    if (!this.webSearchData) {
      this.setTools([]);
      this.eventBus.emit("tools-changed");
      return;
    }

    this.setTools([
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
              items: {
                type: "string",
              },
              description: "Array of URLs to crawl",
            },
          },
        },
      },
    ]);

    this.eventBus.emit("tools-changed");
  };

  getWebSearchEnabled = () => {
    return !!this.webSearchData;
  };
}

export { WebSearch };
