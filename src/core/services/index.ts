export type { HttpMethod, RouteSpec } from "./types";

export { AIEngine, DEFAULT_AI_ROUTES } from "./ai";
export type {
  AIEngineDeps,
  AIEngineMethod,
  SendCustomInput,
  SendInput,
  SendResult,
  SendStreamInput,
} from "./ai";

export { DEFAULT_PROFILES_ROUTES, ProfilesEngine } from "./profiles";
export type {
  CreateProfileInput,
  ProfileMutationResult,
  ProfilesEngineDeps,
  ProfilesEngineMethod,
} from "./profiles";

export { AssignmentsEngine, DEFAULT_ASSIGNMENTS_ROUTES } from "./assignments";
export type {
  AssignmentMutationResult,
  AssignmentsEngineDeps,
  AssignmentsEngineMethod,
  BulkAssignmentResult,
  ResolvedAssignment,
} from "./assignments";

export { DEFAULT_THREADS_ROUTES, ThreadsEngine } from "./threads";
export type {
  OpenOrCreateInput,
  OpenOrCreateResult,
  ThreadsEngineDeps,
  ThreadsEngineMethod,
} from "./threads";

export { DEFAULT_TOOLS_ROUTES, ToolsEngine } from "./tools";
export type {
  McpTransportConfig,
  ToolsBulkResult,
  ToolsEngineDeps,
  ToolsEngineMethod,
  ToolsMutationResult,
} from "./tools";

export { DEFAULT_PROMPTS_ROUTES, PromptsEngine } from "./prompts";
export type {
  CreatePromptInput,
  FolderMutationResult,
  ImportError,
  ImportMode,
  ImportResult,
  PromptBundle,
  PromptMutationResult,
  PromptsEngineDeps,
  PromptsEngineMethod,
} from "./prompts";

export { DEFAULT_WEB_SEARCH_ROUTES, WebSearchEngine } from "./web-search";
export type {
  WebSearchEngineDeps,
  WebSearchEngineMethod,
  WebSearchMutationResult,
} from "./web-search";

export {
  DEFAULT_PREFERENCES,
  DEFAULT_PREFERENCES_ROUTES,
  PreferencesEngine,
} from "./preferences";
export type {
  PreferenceDefaults,
  PreferencesEngineDeps,
  PreferencesEngineMethod,
} from "./preferences";
