// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  ApiProvider,
  createServerAPI,
  DEFAULT_SERVER_API_ROUTES,
  useApi,
  type ServerAPIConfig,
} from "../index";
import {
  DEFAULT_AI_ROUTES,
  DEFAULT_ASSIGNMENTS_ROUTES,
  DEFAULT_ATTACHMENTS_ROUTES,
  DEFAULT_PREFERENCES_ROUTES,
  DEFAULT_PROFILES_ROUTES,
  DEFAULT_PROMPT_HISTORY_ROUTES,
  DEFAULT_PROMPTS_ROUTES,
  DEFAULT_THREADS_ROUTES,
  DEFAULT_TOOLS_ROUTES,
  DEFAULT_WEB_SEARCH_ROUTES,
} from "../../../../core/services";
import type { ReactNode } from "react";

const config: ServerAPIConfig = {
  origin: "https://api.example.com",
  baseUrl: "/v1",
  routes: DEFAULT_SERVER_API_ROUTES,
};

describe("DEFAULT_SERVER_API_ROUTES", () => {
  it("aggregates each per-service route map", () => {
    expect(DEFAULT_SERVER_API_ROUTES).toEqual({
      ai: DEFAULT_AI_ROUTES,
      assignments: DEFAULT_ASSIGNMENTS_ROUTES,
      attachments: DEFAULT_ATTACHMENTS_ROUTES,
      preferences: DEFAULT_PREFERENCES_ROUTES,
      profiles: DEFAULT_PROFILES_ROUTES,
      promptHistory: DEFAULT_PROMPT_HISTORY_ROUTES,
      prompts: DEFAULT_PROMPTS_ROUTES,
      threads: DEFAULT_THREADS_ROUTES,
      tools: DEFAULT_TOOLS_ROUTES,
      webSearch: DEFAULT_WEB_SEARCH_ROUTES,
    });
  });
});

describe("createServerAPI", () => {
  it("returns one slice per service with callable methods", () => {
    const api = createServerAPI(config);
    expect(typeof api.ai.send).toBe("function");
    expect(typeof api.assignments.assign).toBe("function");
    expect(typeof api.attachments.saveFile).toBe("function");
    expect(typeof api.preferences.getDeepMode).toBe("function");
    expect(typeof api.profiles.create).toBe("function");
    expect(typeof api.promptHistory.list).toBe("function");
    expect(typeof api.prompts.create).toBe("function");
    expect(typeof api.threads.create).toBe("function");
    expect(typeof api.tools.addCustomServer).toBe("function");
    expect(typeof api.webSearch.configure).toBe("function");
  });
});

describe("ApiProvider / useApi", () => {
  it("exposes the assembled API to descendants", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider config={config}>{children}</ApiProvider>
    );
    const { result } = renderHook(() => useApi(), { wrapper });
    expect(result.current.ai.send).toBeTypeOf("function");
    expect(result.current.threads.list).toBeTypeOf("function");
  });

  it("memoizes the API across re-renders for stable inputs", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider config={config}>{children}</ApiProvider>
    );
    const { result, rerender } = renderHook(() => useApi(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("throws when used outside of an ApiProvider", () => {
    expect(() => renderHook(() => useApi())).toThrow(
      /useApi must be used within an ApiProvider/
    );
  });
});
