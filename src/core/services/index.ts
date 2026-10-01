export type { HttpMethod, RouteSpec } from "./types";

export { AttachmentsEngine, DEFAULT_ATTACHMENTS_ROUTES } from "./attachments";
export type {
  AttachmentsEngineDeps,
  AttachmentsEngineMethod,
} from "./attachments";

export {
  AIEngine,
  DEFAULT_AI_ROUTES,
  DEFAULT_PERSIST_INTERVAL_MS,
  MIN_PERSIST_INTERVAL_MS,
  toChatError,
  toOpenAIChatCompletionStream,
} from "./ai";
export type {
  AIEngineDeps,
  AIEngineMethod,
  ApproveToolCallInput,
  ChatErrorPayload,
  ChatEvent,
  DenyToolCallInput,
  OpenAIChatCompletionChunk,
  OpenAIChoiceDelta,
  OpenAIChunkChoice,
  OpenAIFinishReason,
  OpenAIStreamChunk,
  OpenAIStreamError,
  OpenAIToolCallDelta,
  RegenerateStreamInput,
  SendCustomInput,
  SendInput,
  SendResult,
  SendStreamInput,
  ToOpenAIStreamOptions,
  ToolCallData,
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

export {
  composeToolsAdapters,
  DEFAULT_TOOLS_ROUTES,
  SystemToolsSource,
  ToolsEngine,
} from "./tools";
export type {
  FetchLike,
  McpHttpServerConfig,
  McpTransportConfig,
  ServersResolver,
  ToolsBulkResult,
  ToolsEngineDeps,
  ToolsEngineMethod,
  ToolsMutationResult,
  TSystemToolsListing,
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

export {
  ContextEngine,
  DEFAULT_CONTEXT_ROUTES,
  READ_SKILL_TOOL,
  SKILLS_TYPE,
  callSkillsTool,
  formatSkillsIndex,
  getSkillsTools,
  resolveRoomSkills,
  withSkillsIndex,
} from "./context";
export type {
  ContextEngineDeps,
  ContextEngineMethod,
  ResolvedRoomSkills,
} from "./context";
