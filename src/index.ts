import "./ui/styles/index.css";

// =============================================================================
// AI Chat Widget — Public API
// =============================================================================
//
// This is the main entry point for the `@onlyoffice/ai-chat` library.
// It re-exports the full public API from domain-specific subpath modules.
//
// Consumers can also import directly from subpaths for better tree-shaking:
//
//   import { AIChatWidget } from "@onlyoffice/ai-chat";
//   import { Provider } from "@onlyoffice/ai-chat/providers";
//   import { createStores } from "@onlyoffice/ai-chat/store";
//   import type { Thread } from "@onlyoffice/ai-chat/types";
//
// =============================================================================

// ---------------------------------------------------------------------------
// AppContext — Dependency Injection
// ---------------------------------------------------------------------------

export type { AppContext } from "./app-context";

// ---------------------------------------------------------------------------
// Capabilities — Action types bound to profiles
// ---------------------------------------------------------------------------

export { ActionType } from "./capabilities";

// ---------------------------------------------------------------------------
// Widget — Main Entry Point
// ---------------------------------------------------------------------------

export { AIChatWidget, type AIChatWidgetProps } from "./AIChatWidget";

// ---------------------------------------------------------------------------
// Widget Config — UI-level runtime flags
// ---------------------------------------------------------------------------

export {
  WidgetConfigProvider,
  useWidgetConfig,
  type ChatErrorAction,
  type ChatErrorContext,
  type ChatErrorOverride,
  type ToolCallApproveContext,
  type PromptDraft,
  type PromptFolderInfo,
  type PromptResult,
  type WidgetConfig,
  type WidgetConfigProviderProps,
} from "./widget-config";

export type {
  AssistantAction,
  AssistantActionContext,
} from "./ui/pages/chat/assistant-actions";

export type { ComposerAction } from "./ui/pages/chat/composer-actions";

export type { ProfilePickerAction } from "./ui/pages/chat/profile-picker-actions";

export type { Suggestion } from "./ui/pages/chat/suggestions";

// ---------------------------------------------------------------------------
// Imperative Ref
// ---------------------------------------------------------------------------

export type { AIChatWidgetRef } from "./ui/providers/ImperativeProvider";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type { StoreKeys } from "./config";

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export { PlatformProvider, usePlatform } from "./ui/providers/PlatformProvider";
export {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_PICK_FILTERS,
} from "./ui/providers/PlatformProvider";
export type {
  AttachmentPickFilter,
  CopyFormat,
  CopyMeta,
  ExportFormat,
  PlatformAdapter,
  PlatformClouds,
  PlatformEnvironment,
  PlatformFileOperations,
  PlatformHostTools,
  PlatformProcessRunner,
} from "./ui/providers/PlatformProvider";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export {
  AbstractBaseProvider,
  createProvider,
  loadProvider,
  getProviderMetadata,
  getProviderName,
  getReasoningSupport,
  reasoningSupportFromCatalog,
  getSupportedProviderTypes,
  isValidProviderType,
  registerProvider,
  unregisterProvider,
} from "./core/providers";
export type {
  BaseProvider,
  OpenRouterReasoningMeta,
  ProviderConstructor,
  ProviderMetadata,
} from "./core/providers";

// ---------------------------------------------------------------------------
// Services (core engines)
// ---------------------------------------------------------------------------

export {
  AIEngine,
  AssignmentsEngine,
  ContextEngine,
  DEFAULT_AI_ROUTES,
  DEFAULT_ASSIGNMENTS_ROUTES,
  DEFAULT_CONTEXT_ROUTES,
  READ_SKILL_TOOL,
  SKILLS_TYPE,
  DEFAULT_PREFERENCES,
  DEFAULT_PREFERENCES_ROUTES,
  DEFAULT_PROFILES_ROUTES,
  DEFAULT_PROMPTS_ROUTES,
  DEFAULT_THREADS_ROUTES,
  DEFAULT_TOOLS_ROUTES,
  DEFAULT_WEB_SEARCH_ROUTES,
  PreferencesEngine,
  ProfilesEngine,
  PromptsEngine,
  SystemToolsSource,
  ThreadsEngine,
  ToolsEngine,
  WebSearchEngine,
  composeToolsAdapters,
  toChatError,
  toOpenAIChatCompletionStream,
} from "./core/services";
export type {
  AIEngineDeps,
  AIEngineMethod,
  ApproveToolCallInput,
  AssignmentMutationResult,
  AssignmentsEngineDeps,
  AssignmentsEngineMethod,
  BulkAssignmentResult,
  ChatErrorPayload,
  ChatEvent,
  CreateProfileInput,
  CreatePromptInput,
  DenyToolCallInput,
  FolderMutationResult,
  HttpMethod,
  ImportError,
  ImportMode,
  ImportResult,
  FetchLike,
  McpHttpServerConfig,
  ServersResolver,
  McpTransportConfig,
  OpenAIChatCompletionChunk,
  OpenAIChoiceDelta,
  OpenAIChunkChoice,
  OpenAIFinishReason,
  OpenAIStreamChunk,
  OpenAIStreamError,
  OpenAIToolCallDelta,
  OpenOrCreateInput,
  OpenOrCreateResult,
  PreferenceDefaults,
  PreferencesEngineDeps,
  PreferencesEngineMethod,
  ProfileMutationResult,
  ProfilesEngineDeps,
  ProfilesEngineMethod,
  PromptBundle,
  PromptMutationResult,
  PromptsEngineDeps,
  PromptsEngineMethod,
  ResolvedAssignment,
  RouteSpec,
  SendCustomInput,
  SendInput,
  SendResult,
  SendStreamInput,
  ToOpenAIStreamOptions,
  ThreadsEngineDeps,
  ThreadsEngineMethod,
  ToolCallData,
  ToolsBulkResult,
  ToolsEngineDeps,
  ToolsEngineMethod,
  ToolsMutationResult,
  WebSearchEngineDeps,
  WebSearchEngineMethod,
  WebSearchMutationResult,
  ContextEngineDeps,
  ContextEngineMethod,
  ResolvedRoomSkills,
} from "./core/services";

// ---------------------------------------------------------------------------
// API (server-bridge layer — switches between in-process engines and HTTP)
// ---------------------------------------------------------------------------

export {
  ApiProvider,
  DEFAULT_SERVER_API_ROUTES,
  createServerAPI,
  useApi,
} from "./ui/providers/ApiProvider";
export type {
  ServerAPI,
  ServerAPIConfig,
  ServerAPIEngines,
  ServerAPIRoutes,
} from "./ui/providers/ApiProvider";

// ---------------------------------------------------------------------------
// Actions (headless per-action execution against a resolved profile)
// ---------------------------------------------------------------------------

export { providerFor } from "./core/actions/provider";
export type { ActionArgs, SystemPromptOverride } from "./core/actions/types";
export {
  DEFAULT_REASONING_LEVEL,
  FULL_REASONING_SUPPORT,
  NO_REASONING_SUPPORT,
  REASONING_DEPTHS,
  REASONING_LEVELS,
  clampReasoningLevel,
  effectiveReasoningLevel,
  isReasoningLevel,
  reasoningSupport,
  resolveReasoningLevel,
  type ReasoningDepth,
  type ReasoningLevel,
  type ReasoningSupport,
} from "./shared/reasoning-level";

// ---------------------------------------------------------------------------
// Settings (key/value adapter contract — implemented by the host)
// ---------------------------------------------------------------------------

export type { SettingsAdapter } from "./shared/settings-adapter";
export {
  SOURCE_METADATA_KEYS,
  sourceMetadataFields,
  type SourceMeta,
  type SourceResolver,
  type SourceScope,
} from "./shared/source-meta";

// ---------------------------------------------------------------------------
// Tools adapter (pluggable runtime tool source the engine resolves
// alongside built-in web-search / image-generation)
// ---------------------------------------------------------------------------

export type { ToolsAdapter } from "./core/tools-adapter";

// ---------------------------------------------------------------------------
// Storage (core adapter contract — concrete implementations are host-supplied)
// ---------------------------------------------------------------------------

export type {
  AssignmentsStorage,
  Attachment,
  AttachmentsStorage,
  ContextFolder,
  ContextRoom,
  McpServerConfig,
  McpServersStorage,
  MessagesCursor,
  MessagesStorage,
  PreferencesStorage,
  ProfilesStorage,
  PromptFoldersStorage,
  PromptsStorage,
  RoomSkill,
  ContextRoomRef,
  StorageAdapter,
  ThreadsCursor,
  ThreadsStorage,
  ToolPrefsStorage,
  WebSearchConfig,
  WebSearchStorage,
} from "./core/storage";
export {
  PAGE_SIZE,
  drainPages,
  messagesCursorOf,
  threadsCursorOf,
} from "./core/storage";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type {
  AddAttachmentOptions,
  AttachmentsStoreState,
  CreateStoresConfig,
  MessageStoreState,
  Page,
  PendingAttachmentInput,
  ProfilesStoreState,
  PromptsStoreState,
  RouterStoreState,
  ServersStoreState,
  Stores,
  ThemeStoreState,
  ThreadsStoreState,
  TPendingAttachment,
} from "./ui/store";
export { createStores, StoresProvider, useStores } from "./ui/store";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export { ToolsProvider, useToolsContext, Servers } from "./ui/tools";
export type { HostTool, HostToolGroup, ToolSource } from "./ui/tools";

// ---------------------------------------------------------------------------
// Types — Domain Models
// ---------------------------------------------------------------------------

export type {
  Model,
  Profile,
  Prompt,
  PromptFolder,
  ProviderType,
  TAttachmentFile,
  TAttachmentImage,
  TAttachmentRef,
  Thread,
  TMCPItem,
  TProcess,
  TProvider,
  TCloud,
  TCloudKey,
  TCloudProvider,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "./types";

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export {
  AiModelsPage,
  ModelAssignmentPage,
  McpServersPage,
  WebSearchPage,
  SettingsPage,
  EmptyScreenPage,
  ChatPage,
} from "./ui/pages";

// ---------------------------------------------------------------------------
// Composite UI Components — high-level building blocks that can be reused
// outside of the bundled pages (e.g. to assemble a custom widget layout).
// Primitive components (Button, Input, Dialog primitives, …) are intentionally
// not re-exported here — swap them via `ComponentsProvider` instead.
// ---------------------------------------------------------------------------

// Layout
export { Layout } from "./ui/components/layout";
export { Navigation } from "./ui/components/layout/sub-components/Header";
export { ChatList } from "./ui/components/layout/sub-components/ChatList";
export { ChatListItem } from "./ui/components/layout/sub-components/ChatListItem";
export { DeleteChatDialog } from "./ui/components/layout/sub-components/DeleteChatDialog";

// Chat page parts
export { Composer } from "./ui/pages/chat/sub-components/Composer";
export { ThreadWelcome } from "./ui/pages/chat/sub-components/Welcome";
export { UserMessage } from "./ui/pages/chat/sub-components/UserMessage";
export { AssistantMessage } from "./ui/pages/chat/sub-components/AssistantMessage";

// Model cards / config
export { ModelCard } from "./ui/components/model-card";
export { DeleteProfileDialog } from "./ui/components/model-card/DeleteProfileDialog";
export {
  AddModelCard,
  EditModelCard,
  type ModelFormValues,
} from "./ui/components/model-config-cards";

// Tool & file UI
export { ManageToolDialog } from "./ui/components/manage-tool-dialog";
export { ToolFallback } from "./ui/components/tool-fallback";
export { FileItem } from "./ui/components/file-item";
export { PendingFileItem } from "./ui/components/file-item/PendingFileItem";

// Markdown
export { MarkdownText, MarkdownContent } from "./ui/components/markdown";

// Toast — mounted by both `AIChatWidget` and `ChatPage` (nesting is a no-op),
// so the chat's own toasts work in either. Export it for hosts that queue
// their own toasts from outside those surfaces.
export {
  DEFAULT_TOAST_DURATION,
  ToastContent,
  ToastProvider,
  useToast,
} from "./ui/components/toast";
export type {
  ShowToastOptions,
  ToastContentProps,
  ToastProviderProps,
} from "./ui/components/toast";

// Misc
export { HelpButton } from "./ui/components/help-button";
export { ProviderLogo } from "./ui/components/provider-logo";
// `SyntaxHighlighter` is re-exported through a lazy wrapper so react-shiki
// (large grammar/theme payload) stays out of the eager root chunk; the type
// re-export is erased at build time and carries no runtime cost.
export { SyntaxHighlighter } from "./ui/components/assistant-ui/shiki-highlighter.lazy";
export type { HighlighterProps } from "./ui/components/assistant-ui/shiki-highlighter";

// ---------------------------------------------------------------------------
// I18n
// ---------------------------------------------------------------------------

export {
  I18nProvider,
  useI18n,
  bundledLocaleKeys,
} from "./ui/providers/LocalesProvider";
export type {
  I18nProviderProps,
  I18nContextValue,
  TranslationKey,
  Translations,
} from "./ui/providers/LocalesProvider";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export {
  ThemeProvider,
  useTheme,
  BUILT_IN_THEMES,
  DARK_THEMES,
} from "./ui/providers/ThemeProvider";
export type {
  ThemeProviderProps,
  ThemeContextValue,
  ThemeTokens,
  ThemeType,
} from "./ui/providers/ThemeProvider";

// ---------------------------------------------------------------------------
// Components — Pluggable UI Component Overrides
// ---------------------------------------------------------------------------

export {
  ComponentsProvider,
  useComponents,
} from "./ui/providers/ComponentsProvider";
export type {
  ButtonProps,
  CheckboxProps,
  ComboBoxProps,
  ComponentOverrides,
  ComponentsProviderProps,
  DialogContentProps,
  DialogFooterProps,
  DialogOverlayProps,
  DropDownItemProps,
  DropdownMenuProps,
  FieldContainerProps,
  HelpButtonProps,
  IconButtonProps,
  InputProps,
  LinkProps,
  LoaderProps,
  RadioButtonProps,
  TabsProps,
  ToggleButtonProps,
  TooltipContentProps,
  TooltipIconButtonProps,
} from "./ui/providers/ComponentsProvider";

// ---------------------------------------------------------------------------
// Images — Pluggable Icon & Image Overrides
// ---------------------------------------------------------------------------

export { ImagesProvider, useImages } from "./ui/providers/ImagesProvider";
export type {
  IconName,
  ImageOverride,
  ImageOverrides,
  ImageResult,
  ImagesContextValue,
  ImagesProviderProps,
} from "./ui/providers/ImagesProvider";

// ---------------------------------------------------------------------------
// Events / Callbacks
// ---------------------------------------------------------------------------

export {
  CallbacksManager,
  EventsProvider,
  useCallbacksManager,
  ChatEventBus,
} from "./ui/providers/EventsProvider";
export type {
  ChatCallbacks,
  ChatErrorEvent,
  CurrentChatProfileUpdatedEvent,
  EventsProviderProps,
  ExtendedThinkingUpdatedEvent,
  MessageSentEvent,
  ModelAssignmentTask,
  ModelAssignmentUpdatedEvent,
  ProfilesUpdateKind,
  ProfilesUpdatedEvent,
  ServersUpdateKind,
  ServersUpdatedEvent,
  StreamDeltaEvent,
  StreamEndEvent,
  StreamErrorEvent,
  StreamStartEvent,
  StreamStopEvent,
  ThreadsUpdateKind,
  ThreadsUpdatedEvent,
  ToolCallApprovedEvent,
  ToolCallAutoApprovedEvent,
  ToolCallDeniedEvent,
  ToolCallPendingEvent,
  ToolCallResultEvent,
  WebSearchUpdatedEvent,
} from "./ui/providers/EventsProvider";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export { MiddlewareRunner } from "./core/middleware";
export type {
  ChatMiddleware,
  BeforeSendContext,
  BeforeSendResult,
  StreamChunkContext,
  StreamChunkResult,
  BeforeToolCallContext,
  BeforeToolCallResult,
  AfterToolResultContext,
  AfterToolResultResult,
  BeforeDisplayContext,
  BeforeDisplayResult,
  ErrorContext,
  ErrorResult,
} from "./core/middleware";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export {
  useDebouncedCallback,
  useDirection,
  useMessages,
  useProfiles,
  useServers,
  useThread,
  useEnsureProfiles,
  useEnsureThreads,
  useEnsurePrompts,
  useEnsureTools,
} from "./ui/hooks";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export {
  convertMessagesToMd,
  getMessageText,
  getMessageTitleFromMd,
  getVerboseExport,
  setVerboseExport,
  type ExportOptions,
} from "./utils";

export {
  isDjVu,
  isDocument,
  isPdf,
  isPdfForm,
  isPresentation,
  isSpreadsheet,
  isVisio,
  isXps,
  sanitizeProviderName,
} from "./shared/utils";

// ---------------------------------------------------------------------------
// Logging — module-global level control (also settable via the widget's
// `logLevel` config). Raise the threshold to quiet the console output.
// ---------------------------------------------------------------------------

export { setLogLevel, getLogLevel, type LogLevel } from "./shared/logger";
