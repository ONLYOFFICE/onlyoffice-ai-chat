import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  DEFAULT_AI_ROUTES,
  DEFAULT_ASSIGNMENTS_ROUTES,
  DEFAULT_ATTACHMENTS_ROUTES,
  DEFAULT_PREFERENCES_ROUTES,
  DEFAULT_PROFILES_ROUTES,
  DEFAULT_PROMPTS_ROUTES,
  DEFAULT_THREADS_ROUTES,
  DEFAULT_TOOLS_ROUTES,
  DEFAULT_WEB_SEARCH_ROUTES,
} from "../../../core/services";
import type {
  AIEngine,
  AIEngineMethod,
  AssignmentsEngine,
  AssignmentsEngineMethod,
  AttachmentsEngine,
  AttachmentsEngineMethod,
  PreferencesEngine,
  PreferencesEngineMethod,
  ProfilesEngine,
  ProfilesEngineMethod,
  PromptsEngine,
  PromptsEngineMethod,
  RouteSpec,
  ThreadsEngine,
  ThreadsEngineMethod,
  ToolsEngine,
  ToolsEngineMethod,
  WebSearchEngine,
  WebSearchEngineMethod,
} from "../../../core/services";
import { createAIApi, type AIApi } from "./ai";
import { createAssignmentsApi, type AssignmentsApi } from "./assignments";
import {
  createAttachmentsApi,
  type AttachmentsApi,
} from "./attachments";
import { createPreferencesApi, type PreferencesApi } from "./preferences";
import { createProfilesApi, type ProfilesApi } from "./profiles";
import { createPromptsApi, type PromptsApi } from "./prompts";
import { createThreadsApi, type ThreadsApi } from "./threads";
import { createToolsApi, type ToolsApi } from "./tools";
import { createWebSearchApi, type WebSearchApi } from "./web-search";

export interface ServerAPIRoutes {
  ai: Record<AIEngineMethod, RouteSpec>;
  assignments: Record<AssignmentsEngineMethod, RouteSpec>;
  attachments: Record<AttachmentsEngineMethod, RouteSpec>;
  preferences: Record<PreferencesEngineMethod, RouteSpec>;
  profiles: Record<ProfilesEngineMethod, RouteSpec>;
  prompts: Record<PromptsEngineMethod, RouteSpec>;
  threads: Record<ThreadsEngineMethod, RouteSpec>;
  tools: Record<ToolsEngineMethod, RouteSpec>;
  webSearch: Record<WebSearchEngineMethod, RouteSpec>;
}

/** Built-in defaults for {@link ServerAPIRoutes} — assembled from each service. */
export const DEFAULT_SERVER_API_ROUTES: ServerAPIRoutes = {
  ai: DEFAULT_AI_ROUTES,
  assignments: DEFAULT_ASSIGNMENTS_ROUTES,
  attachments: DEFAULT_ATTACHMENTS_ROUTES,
  preferences: DEFAULT_PREFERENCES_ROUTES,
  profiles: DEFAULT_PROFILES_ROUTES,
  prompts: DEFAULT_PROMPTS_ROUTES,
  threads: DEFAULT_THREADS_ROUTES,
  tools: DEFAULT_TOOLS_ROUTES,
  webSearch: DEFAULT_WEB_SEARCH_ROUTES,
};

export interface ServerAPIConfig {
  origin: string;
  baseUrl: string;
  headers?: Record<string, string>;
  routes: ServerAPIRoutes;
}

/**
 * Local engine instances used as a fallback when {@link ServerAPIConfig}
 * has no `origin`/`baseUrl` set — every API method then runs in-process
 * against these.
 */
export interface ServerAPIEngines {
  ai: AIEngine;
  assignments: AssignmentsEngine;
  attachments: AttachmentsEngine;
  preferences: PreferencesEngine;
  profiles: ProfilesEngine;
  prompts: PromptsEngine;
  threads: ThreadsEngine;
  tools: ToolsEngine;
  webSearch: WebSearchEngine;
}

/** The assembled API surface — one slice per service. */
export interface ServerAPI {
  ai: AIApi;
  assignments: AssignmentsApi;
  attachments: AttachmentsApi;
  preferences: PreferencesApi;
  profiles: ProfilesApi;
  prompts: PromptsApi;
  threads: ThreadsApi;
  tools: ToolsApi;
  webSearch: WebSearchApi;
}

const ApiContext = createContext<ServerAPI | null>(null);

/** Build the full {@link ServerAPI} surface from a config + optional engines. */
export function createServerAPI(
  config: ServerAPIConfig,
  engines?: ServerAPIEngines
): ServerAPI {
  return {
    ai: createAIApi(config, engines),
    assignments: createAssignmentsApi(config, engines),
    attachments: createAttachmentsApi(config, engines),
    preferences: createPreferencesApi(config, engines),
    profiles: createProfilesApi(config, engines),
    prompts: createPromptsApi(config, engines),
    threads: createThreadsApi(config, engines),
    tools: createToolsApi(config, engines),
    webSearch: createWebSearchApi(config, engines),
  };
}

interface ApiProviderProps {
  config: ServerAPIConfig;
  engines?: ServerAPIEngines;
  children: ReactNode;
}

export function ApiProvider({ config, engines, children }: ApiProviderProps) {
  const api = useMemo<ServerAPI>(
    () => createServerAPI(config, engines),
    [config, engines]
  );
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): ServerAPI {
  const ctx = useContext(ApiContext);
  if (ctx === null) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return ctx;
}
