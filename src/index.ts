import "./styles/index.css";

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
// Widget — Main Entry Point
// ---------------------------------------------------------------------------

export { AIChatWidget, type AIChatWidgetProps } from "./AIChatWidget";

// ---------------------------------------------------------------------------
// Imperative Ref
// ---------------------------------------------------------------------------

export type { AIChatWidgetRef } from "./imperative";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type { StoreKeys } from "./config";

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export { PlatformProvider, usePlatform } from "./platform";
export type {
  PlatformAdapter,
  PlatformClouds,
  PlatformEnvironment,
  PlatformFileOperations,
  PlatformHostTools,
  PlatformProcessRunner,
} from "./platform";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export {
  default as Provider,
  type SendMessageReturnType,
  AbstractBaseProvider,
  createProvider,
  getProvider,
  getSupportedProviderTypes,
  isValidProviderType,
  registerProvider,
  unregisterProvider,
} from "./providers";
export type { BaseProvider } from "./providers";

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export type {
  ChangeToolStatusResult,
  ChatEvent,
  ProfilesInitResult,
  PromptUpdates,
  TaskProfileKeys,
  ToolCallData,
  ToolsListResult,
} from "./services";
export {
  applyProfileToAction,
  ChatEngine,
  getActionProvider,
  initActionHolders,
  ProfilesService,
  PromptsService,
  ServersService,
  ThreadsService,
} from "./services";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export { SettingsProvider, useSettings } from "./settings";
export type { SettingsAdapter } from "./settings";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export { StorageProvider, useStorage, getStorageInstance } from "./storage";
export type {
  MessagesStorage,
  ProfilesStorage,
  PromptFoldersStorage,
  PromptsStorage,
  StorageAdapter,
  ThreadsStorage,
} from "./storage";

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
} from "./store";
export { createStores, StoresProvider, useStores } from "./store";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export { ToolsProvider, useToolsContext, Servers } from "./tools";
export type { HostTool, HostToolGroup, ToolSource } from "./tools";

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
} from "./pages";

// ---------------------------------------------------------------------------
// I18n
// ---------------------------------------------------------------------------

export { I18nProvider, useI18n, bundledLocaleKeys } from "./locales";
export type {
  I18nProviderProps,
  I18nContextValue,
  TranslationKey,
  Translations,
} from "./locales";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export { ThemeProvider, useTheme, BUILT_IN_THEMES, DARK_THEMES } from "./theme";
export type {
  ThemeProviderProps,
  ThemeContextValue,
  ThemeTokens,
  ThemeType,
} from "./theme";

// ---------------------------------------------------------------------------
// Components — Pluggable UI Component Overrides
// ---------------------------------------------------------------------------

export { ComponentsProvider, useComponents } from "./components-provider";
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
} from "./components-provider";

// ---------------------------------------------------------------------------
// Images — Pluggable Icon & Image Overrides
// ---------------------------------------------------------------------------

export { ImagesProvider, useImages } from "./images-provider";
export type {
  IconName,
  ImageOverride,
  ImageOverrides,
  ImageResult,
  ImagesContextValue,
  ImagesProviderProps,
} from "./images-provider";

// ---------------------------------------------------------------------------
// Events / Callbacks
// ---------------------------------------------------------------------------

export {
  CallbacksManager,
  EventsProvider,
  useCallbacksManager,
  ChatEventBus,
} from "./events";
export type {
  ChatCallbacks,
  ChatErrorEvent,
  EventsProviderProps,
  MessageSentEvent,
  ProfileChangedEvent,
  ProfileCreatedEvent,
  ProfileDeletedEvent,
  StreamDeltaEvent,
  StreamEndEvent,
  StreamErrorEvent,
  StreamStartEvent,
  StreamStopEvent,
  ThreadClearedEvent,
  ThreadCreatedEvent,
  ThreadDeletedEvent,
  ThreadRenamedEvent,
  ThreadSwitchedEvent,
  ToolCallApprovedEvent,
  ToolCallAutoApprovedEvent,
  ToolCallDeniedEvent,
  ToolCallPendingEvent,
  ToolCallResultEvent,
} from "./events";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export { MiddlewareRunner } from "./middleware";
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
} from "./middleware";

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
} from "./hooks";

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
} from "./lib/utils";
