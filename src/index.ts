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
  type WidgetConfig,
  type WidgetConfigProviderProps,
} from "./widget-config";

// ---------------------------------------------------------------------------
// Imperative Ref
// ---------------------------------------------------------------------------

export type { AIChatWidgetRef } from "./ui/imperative";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type { StoreKeys } from "./config";

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export { PlatformProvider, usePlatform } from "./ui/platform";
export type {
  PlatformAdapter,
  PlatformClouds,
  PlatformEnvironment,
  PlatformFileOperations,
  PlatformHostTools,
  PlatformProcessRunner,
} from "./ui/platform";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export {
  AbstractBaseProvider,
  createProvider,
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
  registerProvider,
  unregisterProvider,
} from "./core/providers";
export type { BaseProvider, ProviderConstructor } from "./core/providers";

// ---------------------------------------------------------------------------
// Services (core engines)
// ---------------------------------------------------------------------------

export {
  AIEngine,
  AssignmentsEngine,
  DEFAULT_AI_ROUTES,
  DEFAULT_ASSIGNMENTS_ROUTES,
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
  ThreadsEngine,
  ToolsEngine,
  WebSearchEngine,
} from "./core/services";
export type {
  AIEngineDeps,
  AIEngineMethod,
  ApproveToolCallInput,
  AssignmentMutationResult,
  AssignmentsEngineDeps,
  AssignmentsEngineMethod,
  BulkAssignmentResult,
  ChatEvent,
  CreateProfileInput,
  CreatePromptInput,
  DenyToolCallInput,
  FolderMutationResult,
  HttpMethod,
  ImportError,
  ImportMode,
  ImportResult,
  McpTransportConfig,
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
} from "./core/services";

// ---------------------------------------------------------------------------
// Settings (key/value adapter contract — implemented by the host)
// ---------------------------------------------------------------------------

export type { SettingsAdapter } from "./shared/settings-adapter";

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
  McpServerConfig,
  McpServersStorage,
  MessagesStorage,
  PreferencesStorage,
  ProfilesStorage,
  PromptFoldersStorage,
  PromptsStorage,
  StorageAdapter,
  ThreadsStorage,
  ToolPrefsStorage,
  WebSearchConfig,
  WebSearchStorage,
} from "./core/storage";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type {
  AttachmentsStoreState,
  CreateStoresConfig,
  MessageStoreState,
  Page,
  ProfilesStoreState,
  PromptsStoreState,
  RouterStoreState,
  ServersStoreState,
  Stores,
  ThemeStoreState,
  ThreadsStoreState,
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
// I18n
// ---------------------------------------------------------------------------

export { I18nProvider, useI18n, bundledLocaleKeys } from "./ui/providers/LocalesProvider";
export type {
  I18nProviderProps,
  I18nContextValue,
  TranslationKey,
  Translations,
} from "./ui/providers/LocalesProvider";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export { ThemeProvider, useTheme, BUILT_IN_THEMES, DARK_THEMES } from "./ui/providers/ThemeProvider";
export type {
  ThemeProviderProps,
  ThemeContextValue,
  ThemeTokens,
  ThemeType,
} from "./ui/providers/ThemeProvider";

// ---------------------------------------------------------------------------
// Components — Pluggable UI Component Overrides
// ---------------------------------------------------------------------------

export { ComponentsProvider, useComponents } from "./ui/providers/ComponentsProvider";
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
  SystemPromptAppendixUpdatedEvent,
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
} from "./ui/hooks";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { convertMessagesToMd, getMessageTitleFromMd } from "./utils";

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
