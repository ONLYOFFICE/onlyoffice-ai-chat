import { type AppendMessage } from "@assistant-ui/react";
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppContext } from "./app-context";
import type { StoreKeys } from "./config";
import { CallbacksManager, ChatEventBus } from "./ui/providers/EventsProvider";
import type { ChatCallbacks } from "./ui/providers/EventsProvider";
import { MiddlewareRunner } from "./core/middleware";
import type { ChatMiddleware } from "./core/middleware";
import {
  AIEngine,
  AssignmentsEngine,
  AttachmentsEngine,
  PreferencesEngine,
  ProfilesEngine,
  PromptsEngine,
  ThreadsEngine,
  ToolsEngine,
  WebSearchEngine,
} from "./core/services";
import type { StorageAdapter } from "./core/storage";
import { PlatformProvider } from "./ui/providers/PlatformProvider/context";
import type { PlatformAdapter } from "./ui/providers/PlatformProvider/types";
import logger from "./shared/logger";
import type { SettingsAdapter } from "./shared/settings-adapter";
import { Layout } from "./ui/components/layout";
import { EventsProvider } from "./ui/providers/EventsProvider";
import Settings from "./ui/pages/settings";
import Thread from "./ui/pages/chat";
import {
  ApiProvider,
  createServerAPI,
  DEFAULT_SERVER_API_ROUTES,
  type ServerAPIConfig,
} from "./ui/providers/ApiProvider";
import { ComponentsProvider } from "./ui/providers/ComponentsProvider";
import type { ComponentOverrides } from "./ui/providers/ComponentsProvider";
import { ImagesProvider } from "./ui/providers/ImagesProvider";
import type { ImageOverrides } from "./ui/providers/ImagesProvider";
import { I18nProvider } from "./ui/providers/LocalesProvider";
import type { Translations } from "./ui/providers/LocalesProvider";
import { ThemeProvider } from "./ui/providers/ThemeProvider";
import type { ThemeTokens } from "./ui/providers/ThemeProvider";
import { StoresProvider, useStores } from "./ui/store/context";
import { createStores } from "./ui/store/create-stores";
import { ToolsProvider, useToolsContext } from "./ui/tools/context";
import Servers from "./ui/tools/servers";
import type { ToolsAdapter } from "./core/tools-adapter";
import type { HostToolGroup } from "./ui/tools/types";
import {
  useWidgetConfig,
  WidgetConfigProvider,
  type WidgetConfig,
} from "./widget-config";
import type { ProviderFetch } from "./shared/provider-credentials";
import type { SystemPromptOverride } from "./core/actions";
import type { AssistantAction } from "./ui/pages/chat/assistant-actions";
import type { ComposerAction } from "./ui/pages/chat/composer-actions";
import type {
  ProviderType,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "./types";
import type {
  AIChatWidgetRef,
  ComposerBridge,
} from "./ui/providers/ImperativeProvider";
import {
  ComposerBridgeProvider,
  createWidgetRef,
  type RefCallbacks,
} from "./ui/providers/ImperativeProvider";
import useMessages from "./ui/hooks/useMessages";

export interface AIChatWidgetProps {
  storage: StorageAdapter;
  settings: SettingsAdapter;
  platform: PlatformAdapter;
  locale?: string;
  translations?: Partial<Translations>;
  theme?: string;
  customTheme?: Partial<ThemeTokens>;
  customThemes?: Record<string, Partial<ThemeTokens>>;
  storeKeys: StoreKeys;
  components?: Partial<ComponentOverrides>;
  images?: ImageOverrides;
  /**
   * Preferred format for built-in icons that ship as both a vector SVG and a
   * multi-scale raster (PNG) set. `"svg"` (default) renders the inlined SVG
   * component — crisp at any size, recolored to the theme. `"png"` gives
   * priority to the scale-appropriate PNG, falling back to the SVG for icons
   * that have no raster variant. Host overrides via `images` always win over
   * both. See {@link ImagesProviderProps.iconFormat}.
   */
  iconFormat?: "svg" | "png";
  hostToolGroups?: HostToolGroup[];
  /**
   * Optional pluggable tool source. The engine resolves `getTools()`
   * server-side alongside built-in web-search / image-generation, then
   * dispatches `callTool(...)` automatically when the model picks an
   * adapter-served tool — no UI approval round-trip.
   */
  toolsAdapter?: ToolsAdapter;
  onMigrate?: () => Promise<void>;
  callbacks?: ChatCallbacks;
  middleware?: ChatMiddleware[];
  onlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
  /**
   * Controls the composer's model (profile) picker. An explicit `true` /
   * `false` always wins; omitted falls back to hiding the picker only when
   * `entityId` is set. See {@link WidgetConfig.hideProfilePicker}.
   */
  hideProfilePicker?: boolean;
  /**
   * Hide the floating "scroll to bottom" button in the chat thread. Shown by
   * default. See {@link WidgetConfig.hideScrollToBottomButton}.
   */
  hideScrollToBottomButton?: boolean;
  /**
   * Hide the top and bottom fade overlays in the chat thread. Shown by
   * default. See {@link WidgetConfig.hideThreadFade}.
   */
  hideThreadFade?: boolean;
  hideSettingsButton?: boolean;
  /**
   * Icon name for the chat-history panel's close button. Defaults to
   * `"btn-close"`; set to `"btn-arrow-up"` when the host panel already has
   * its own close button. See {@link WidgetConfig.chatHistoryCloseIcon}.
   */
  chatHistoryCloseIcon?: WidgetConfig["chatHistoryCloseIcon"];
  /**
   * Which edge the search input's magnifier icon sits on (currently the
   * chat-history search field). Defaults to `"end"`; set to `"start"` to keep
   * it visible while typing. See {@link WidgetConfig.inputIconPosition}.
   */
  inputIconPosition?: WidgetConfig["inputIconPosition"];
  /**
   * Hide the chat-history panel's header row (title + close button), keeping
   * the search field and thread list. See
   * {@link WidgetConfig.hideChatHistoryHeader}.
   */
  hideChatHistoryHeader?: boolean;
  /**
   * Show each chat-history thread's actions trigger permanently instead
   * of only on hover. See {@link WidgetConfig.chatHistoryAlwaysShowActions}.
   */
  chatHistoryAlwaysShowActions?: boolean;
  /**
   * Chevron icon for the regular (settings-form) comboboxes. Defaults to
   * `"arrow"`. See {@link WidgetConfig.comboBoxArrowIcon}.
   */
  comboBoxArrowIcon?: WidgetConfig["comboBoxArrowIcon"];
  /**
   * Chevron icon for the composer's model selector. Defaults to `"arrow"`;
   * set it to differ from the form comboboxes. See
   * {@link WidgetConfig.modelSelectorArrowIcon}.
   */
  modelSelectorArrowIcon?: WidgetConfig["modelSelectorArrowIcon"];
  hideToolAllowAlways?: WidgetConfig["hideToolAllowAlways"];
  /**
   * Render the "Add model" form in a two-row (horizontal) layout
   * instead of the default single-column stack. Affects both the
   * Settings → AI Models page and the InitialSetup screen that the
   * chat surface falls back to when no profiles are configured. Use
   * this in wider hosts where the extra horizontal space is available.
   */
  isAddModelCardHorizontal?: boolean;
  onSettingsClick?: () => void;
  isSettingsActive?: boolean;
  isDialogFullscreen?: boolean;
  /**
   * Opaque scope token for entity-bound chat ("rooms"). When set, the
   * widget shows only threads belonging to this entity, all
   * tools/servers/web-search/preferences/assignments lookups are
   * scoped to this entity, and a fixed per-entity chat profile is used
   * (resolved by the host's storage).
   *
   * Fixed at mount; live switching is not supported.
   */
  entityId?: string;
  /**
   * Custom system prompt for the chat action. Replaces or appends to
   * the built-in prompt for every chat round (including tool-call
   * resume rounds). Other action types are unaffected.
   */
  systemPrompt?: SystemPromptOverride;
  /**
   * Route every (non-`"external"`) provider request through the host's
   * `PlatformAdapter.fetchProxy`, ignoring each profile's `useProxy` flag.
   * Use this for server-side deployments that must funnel all upstream
   * traffic through the document-server proxy. No effect when the platform
   * doesn't supply `fetchProxy`.
   */
  forceProxy?: boolean;
  /**
   * Opt out of the built-in `generate_image` chat tool. Use this when the
   * host ships its own image-generation tool and doesn't want two
   * same-purpose tools offered to the model. Default false. Affects only
   * the chat tool — the one-shot image-generation action still works.
   */
  disableBuiltinImageTool?: boolean;
  /**
   * Global cursor-pagination switch (default false). Threads and
   * messages are read in pages of 100 (`count`/`cursor` params on
   * `threads.readAll` / `messages.readByThread`), and the sidebar
   * infinite-scrolls. Requires a storage adapter / backend that honors
   * those parameters; with the flag off no pagination parameters are
   * ever sent. See {@link WidgetConfig.enablePagination}.
   */
  enablePagination?: boolean;
  /** Optional remote API routing — defaults to in-process engines. */
  apiConfig?: Partial<Pick<ServerAPIConfig, "origin" | "baseUrl" | "headers">>;
  /**
   * Extra buttons rendered under every assistant message, appended after
   * the built-in Copy and Save. Each action's `onClick` receives the text
   * (and the raw message) of the corresponding assistant reply.
   */
  assistantActions?: AssistantAction[];
  /**
   * Extra items appended to the composer's "+" (attachments) dropdown,
   * rendered above the built-in Web Search / Extended Thinking block.
   */
  composerActions?: ComposerAction[];
  /**
   * Clickable prompt suggestions shown above the composer in a new (empty)
   * chat. Each item is `{ name, prompt }`; clicking inserts its `prompt`
   * into the composer. Capped at 20. See {@link WidgetConfig.suggestions}.
   */
  suggestions?: WidgetConfig["suggestions"];
  /**
   * Arbitrary content rendered at the very top of a new (empty) chat,
   * shown only when suggestions are visible. See
   * {@link WidgetConfig.suggestionsHeader}.
   */
  suggestionsHeader?: WidgetConfig["suggestionsHeader"];
  /**
   * Arbitrary content rendered directly above the composer, in both the
   * empty and non-empty chat states — e.g. a host-owned "AI features
   * aren't active" banner. See {@link WidgetConfig.composerHeader}.
   */
  composerHeader?: WidgetConfig["composerHeader"];
  /**
   * Disable the composer entirely — the input becomes non-editable and every
   * composer control is made non-interactive and dimmed. Pair with
   * {@link AIChatWidgetProps.composerHeader} to explain why. See
   * {@link WidgetConfig.composerDisabled}.
   */
  composerDisabled?: WidgetConfig["composerDisabled"];
  /**
   * Handler for the "Import" link in the add-profile card. The host owns
   * the import flow; an optional `Partial<ModelFormValues>` return pre-fills
   * the add-profile form. See {@link WidgetConfig.onProfileImportClick}.
   */
  onProfileImportClick?: WidgetConfig["onProfileImportClick"];
  /**
   * Handler for the "Download template" link in the add-profile card's info
   * tooltip. See {@link WidgetConfig.onDownloadTemplate}.
   */
  onDownloadTemplate?: WidgetConfig["onDownloadTemplate"];
  /**
   * Custom confirmation for deleting a profile. When provided, the built-in
   * confirmation dialog is skipped and the host owns the confirmation UI.
   * See {@link WidgetConfig.onDeleteProfile}.
   */
  onDeleteProfile?: WidgetConfig["onDeleteProfile"];
  /**
   * Custom confirmation for deleting a chat (thread). When provided, the
   * built-in confirmation dialog is skipped and the host owns the confirmation
   * UI. See {@link WidgetConfig.onDeleteThread}.
   */
  onDeleteThread?: WidgetConfig["onDeleteThread"];
  /**
   * Custom UI for creating a new prompt folder. When provided, the built-in
   * "New prompt folder" dialog is skipped and the host owns the input UI.
   * See {@link WidgetConfig.onCreatePromptFolder}.
   */
  onCreatePromptFolder?: WidgetConfig["onCreatePromptFolder"];
  /**
   * Custom UI for renaming a prompt folder. When provided, the built-in
   * "Rename folder" dialog is skipped and the host owns the input UI.
   * See {@link WidgetConfig.onRenamePromptFolder}.
   */
  onRenamePromptFolder?: WidgetConfig["onRenamePromptFolder"];
  /**
   * Custom UI for deleting a prompt folder. When provided, the built-in
   * "Delete folder" confirmation dialog is skipped and the host owns the
   * confirmation UI. See {@link WidgetConfig.onDeletePromptFolder}.
   */
  onDeletePromptFolder?: WidgetConfig["onDeletePromptFolder"];
  /**
   * Custom UI for deleting a saved prompt. When provided, the built-in
   * "Delete prompt" confirmation dialog is skipped and the host owns the
   * confirmation UI. See {@link WidgetConfig.onDeletePrompt}.
   */
  onDeletePrompt?: WidgetConfig["onDeletePrompt"];
  /**
   * Custom UI for creating a prompt. When provided, the built-in
   * "Save prompt" auto-name path is replaced and the host owns the input UI.
   * See {@link WidgetConfig.onCreatePrompt}.
   */
  onCreatePrompt?: WidgetConfig["onCreatePrompt"];
  /**
   * Custom UI for editing a prompt. When provided, the built-in
   * "Edit prompt" dialog is skipped and the host owns the input UI.
   * See {@link WidgetConfig.onEditPrompt}.
   */
  onEditPrompt?: WidgetConfig["onEditPrompt"];
  /**
   * Handler for opening a host-owned "Custom Providers" screen. When
   * provided, a "Custom Providers" button is shown next to "Add Model".
   * See {@link WidgetConfig.onOpenCustomProvider}.
   */
  onOpenCustomProvider?: WidgetConfig["onOpenCustomProvider"];
  /**
   * Confirmation gate fired when leaving the MCP servers tab with unsaved
   * config edits. See {@link WidgetConfig.onDiscardMcpChanges}.
   */
  onDiscardMcpChanges?: WidgetConfig["onDiscardMcpChanges"];
  /**
   * Fired with the approved tool's result before the confirmation dialog
   * closes and the stream continues. See
   * {@link WidgetConfig.onToolCallApproveResult}.
   */
  onToolCallApproveResult?: WidgetConfig["onToolCallApproveResult"];
  /**
   * Rewrites the in-chat assistant error box's title, description, and
   * button — branch on the normalized payload's `code` and return the slots
   * to replace, or `null` to keep the defaults. See
   * {@link WidgetConfig.formatChatError}.
   */
  formatChatError?: WidgetConfig["formatChatError"];
  /**
   * Minimum log severity that reaches the console. Raise it to quiet the
   * library's `info`/`debug` tracing (`"warn"`, `"error"`, or `"silent"`);
   * defaults to logging everything. See {@link WidgetConfig.logLevel}.
   */
  logLevel?: WidgetConfig["logLevel"];
  /**
   * Write the full message model (tool calls with arguments and results,
   * reasoning, attachments) into every chat/message export instead of only
   * the conversation prose. Set it when the editor runs in debug mode.
   * See {@link WidgetConfig.debugExport}.
   */
  debugExport?: WidgetConfig["debugExport"];
}

export const AIChatWidget = React.forwardRef<
  AIChatWidgetRef,
  AIChatWidgetProps
>(
  (
    {
      storage,
      settings: _settings,
      platform,
      locale,
      translations,
      theme,
      customTheme,
      customThemes,
      storeKeys,
      components,
      images,
      iconFormat,
      hostToolGroups: hostToolGroupsProp,
      toolsAdapter,
      onMigrate,
      callbacks,
      middleware,
      onlyofficeConfig,
      hiddenProviders,
      hiddenWebSearchProviders,
      hideProfilePicker,
      hideScrollToBottomButton,
      hideThreadFade,
      hideSettingsButton,
      chatHistoryCloseIcon,
      inputIconPosition,
      hideChatHistoryHeader,
      chatHistoryAlwaysShowActions,
      comboBoxArrowIcon,
      modelSelectorArrowIcon,
      hideToolAllowAlways,
      isAddModelCardHorizontal,
      onSettingsClick,
      isSettingsActive,
      isDialogFullscreen,
      entityId,
      systemPrompt,
      forceProxy,
      disableBuiltinImageTool,
      enablePagination,
      apiConfig,
      assistantActions,
      composerActions,
      suggestions,
      suggestionsHeader,
      composerHeader,
      composerDisabled,
      onProfileImportClick,
      onDownloadTemplate,
      onDeleteProfile,
      onDeleteThread,
      onCreatePromptFolder,
      onRenamePromptFolder,
      onDeletePromptFolder,
      onDeletePrompt,
      onCreatePrompt,
      onEditPrompt,
      onOpenCustomProvider,
      onDiscardMcpChanges,
      onToolCallApproveResult,
      formatChatError,
      logLevel,
      debugExport,
    },
    ref
  ) => {
    const widgetConfig = useMemo(
      () => ({
        hideProfilePicker,
        hideScrollToBottomButton,
        hideThreadFade,
        hideSettingsButton,
        chatHistoryCloseIcon,
        inputIconPosition,
        hideChatHistoryHeader,
        chatHistoryAlwaysShowActions,
        comboBoxArrowIcon,
        modelSelectorArrowIcon,
        hideToolAllowAlways,
        isAddModelCardHorizontal,
        onSettingsClick,
        isSettingsActive,
        isDialogFullscreen,
        entityId,
        enablePagination,
        systemPrompt,
        assistantActions,
        composerActions,
        suggestions,
        suggestionsHeader,
        composerHeader,
        composerDisabled,
        onProfileImportClick,
        onDownloadTemplate,
        onDeleteProfile,
        onDeleteThread,
        onCreatePromptFolder,
        onRenamePromptFolder,
        onDeletePromptFolder,
        onDeletePrompt,
        onCreatePrompt,
        onEditPrompt,
        onOpenCustomProvider,
        onDiscardMcpChanges,
        onToolCallApproveResult,
        formatChatError,
        logLevel,
        debugExport,
      }),
      [
        hideProfilePicker,
        hideScrollToBottomButton,
        hideThreadFade,
        hideSettingsButton,
        chatHistoryCloseIcon,
        inputIconPosition,
        hideChatHistoryHeader,
        chatHistoryAlwaysShowActions,
        comboBoxArrowIcon,
        modelSelectorArrowIcon,
        hideToolAllowAlways,
        isAddModelCardHorizontal,
        onSettingsClick,
        isSettingsActive,
        isDialogFullscreen,
        entityId,
        enablePagination,
        systemPrompt,
        assistantActions,
        composerActions,
        suggestions,
        suggestionsHeader,
        composerHeader,
        composerDisabled,
        onProfileImportClick,
        onDownloadTemplate,
        onDeleteProfile,
        onDeleteThread,
        onCreatePromptFolder,
        onRenamePromptFolder,
        onDeletePromptFolder,
        onDeletePrompt,
        onCreatePrompt,
        onEditPrompt,
        onOpenCustomProvider,
        onDiscardMcpChanges,
        onToolCallApproveResult,
        formatChatError,
        logLevel,
        debugExport,
      ]
    );

    // Build AppContext + engines + ServerAPI for this widget instance
    const { ctx, stores, engines, serverApiConfig } = useMemo(() => {
      const eventBus = new ChatEventBus();
      const callbacksManager = new CallbacksManager();
      const middlewareRunner = new MiddlewareRunner(middleware ?? []);

      const assignments = new AssignmentsEngine({ storage });
      const threads = new ThreadsEngine({
        storage,
        ...(enablePagination ? { pagination: true } : {}),
      });
      const tools = new ToolsEngine({ storage });
      const prompts = new PromptsEngine({ storage });
      const preferences = new PreferencesEngine({ storage });
      const attachments = new AttachmentsEngine({ storage });

      const servers = new Servers(platform, eventBus);

      // PlatformAdapter.fetchProxy / externalFetch take a `string`
      // URL; the provider SDKs pass `RequestInfo | URL`. Normalize
      // before delegating so host implementations that only handle
      // strings keep working.
      const normalizeFetch = (
        host: (url: string, init?: RequestInit) => Promise<Response>
      ): ProviderFetch => {
        return (input, init) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          return host(url, init);
        };
      };

      const proxyFetch: ProviderFetch | undefined = platform.fetchProxy
        ? normalizeFetch(platform.fetchProxy)
        : undefined;
      const externalFetch: ProviderFetch | undefined = platform.externalFetch
        ? normalizeFetch(platform.externalFetch)
        : undefined;

      const profiles = new ProfilesEngine({
        storage,
        assignments,
        ...(proxyFetch ? { fetchProxy: proxyFetch } : {}),
        ...(externalFetch ? { externalFetch } : {}),
        ...(forceProxy ? { forceProxy: true } : {}),
      });

      // Web search routes its HTTP through the host proxy only when one
      // is configured; otherwise it falls back to the global `fetch`.
      const webSearch = new WebSearchEngine({
        storage,
        ...(proxyFetch ? { fetch: proxyFetch } : {}),
      });

      const ai = new AIEngine({
        storage,
        assignments,
        threads,
        toolsAdapter,
        ...(proxyFetch ? { fetchProxy: proxyFetch } : {}),
        ...(externalFetch ? { externalFetch } : {}),
        ...(forceProxy ? { forceProxy: true } : {}),
        ...(disableBuiltinImageTool ? { disableBuiltinImageTool: true } : {}),
        ...(enablePagination ? { pagination: true } : {}),
      });

      const ctx: AppContext = {
        storage,
        platform,
        servers,
        eventBus,
        callbacksManager,
        middlewareRunner,
        onlyofficeConfig,
        hiddenProviders,
        hiddenWebSearchProviders,
      };

      const engines = {
        ai,
        assignments,
        attachments,
        preferences,
        profiles,
        prompts,
        threads,
        tools,
        webSearch,
      };

      const serverApiConfig: ServerAPIConfig = {
        origin: apiConfig?.origin ?? "",
        baseUrl: apiConfig?.baseUrl ?? "",
        headers: apiConfig?.headers,
        routes: DEFAULT_SERVER_API_ROUTES,
      };

      const api = createServerAPI(serverApiConfig, engines);
      const stores = createStores({
        keys: storeKeys,
        ctx,
        api,
        entityId,
        ...(enablePagination ? { enablePagination: true } : {}),
      });

      return { ctx, stores, engines, serverApiConfig };
    }, [
      storage,
      platform,
      storeKeys,
      middleware,
      onlyofficeConfig,
      hiddenProviders,
      hiddenWebSearchProviders,
      apiConfig,
      toolsAdapter,
      entityId,
      forceProxy,
      disableBuiltinImageTool,
      enablePagination,
    ]);

    // Tear down MCP servers when this widget instance is replaced (ctx
    // rebuilt) or unmounts — otherwise stdio child processes and stateful
    // HTTP sessions are orphaned for the lifetime of the host page.
    useEffect(() => {
      const { servers } = ctx;
      return () => {
        servers.dispose();
      };
    }, [ctx]);

    return (
      <EventsProvider
        callbacksManager={ctx.callbacksManager}
        callbacks={callbacks}
      >
        <PlatformProvider platform={platform}>
          <I18nProvider locale={locale} translations={translations}>
            <ComponentsProvider overrides={components}>
              <WidgetConfigProvider config={widgetConfig}>
                <ApiProvider config={serverApiConfig} engines={engines}>
                  <StoresProvider stores={stores}>
                    <ThemeProvider
                      theme={theme}
                      customTheme={customTheme}
                      customThemes={customThemes}
                    >
                      <ImagesProvider
                        overrides={images}
                        iconFormat={iconFormat}
                      >
                        <AppWithTools
                          hostToolGroupsProp={hostToolGroupsProp}
                          onMigrate={onMigrate}
                          servers={ctx.servers}
                          eventBus={ctx.eventBus}
                          widgetRef={ref}
                        />
                      </ImagesProvider>
                    </ThemeProvider>
                  </StoresProvider>
                </ApiProvider>
              </WidgetConfigProvider>
            </ComponentsProvider>
          </I18nProvider>
        </PlatformProvider>
      </EventsProvider>
    );
  }
);

AIChatWidget.displayName = "AIChatWidget";

const AppWithTools = ({
  hostToolGroupsProp,
  onMigrate,
  servers,
  eventBus,
  widgetRef,
}: {
  hostToolGroupsProp?: HostToolGroup[];
  onMigrate?: () => Promise<void>;
  servers: Servers;
  eventBus: ChatEventBus;
  widgetRef?: React.ForwardedRef<AIChatWidgetRef>;
}) => {
  const hostToolGroups: HostToolGroup[] = useMemo(() => {
    if (hostToolGroupsProp) return hostToolGroupsProp;
    return [];
  }, [hostToolGroupsProp]);

  return (
    <ToolsProvider
      hostToolGroups={hostToolGroups}
      servers={servers}
      eventBus={eventBus}
    >
      <AppInner onMigrate={onMigrate} widgetRef={widgetRef} />
    </ToolsProvider>
  );
};

const AppInner = ({
  onMigrate,
  widgetRef,
}: {
  onMigrate?: () => Promise<void>;
  widgetRef?: React.ForwardedRef<AIChatWidgetRef>;
}) => {
  const [isReady, setIsReady] = useState(false);

  const stores = useStores();
  const {
    useProfilesStore,
    useRouter,
    useCloudsStore,
    selectCurrentChatProfile,
    callbacksManager,
  } = stores;

  const { currentPage } = useRouter();
  const { fetchClouds } = useCloudsStore();
  const { servers, eventBus } = useToolsContext();
  const { entityId } = useWidgetConfig();

  // Profile init is owned by whichever page mounts (`<Thread />` /
  // `<Settings />`) via its own `useEnsureProfiles` — the widget no longer
  // fires a second, redundant `init()` here. `init()` now coalesces
  // concurrent callers, so the page-level hooks that run in the same tick
  // share one load; `onReady` fires once the mounted page has hydrated.
  const profilesInitialized = useProfilesStore((s) => s.initialized);
  const readyEmittedRef = useRef(false);
  useEffect(() => {
    if (!profilesInitialized || readyEmittedRef.current) return;
    readyEmittedRef.current = true;
    const state = useProfilesStore.getState();
    const current = selectCurrentChatProfile(state);
    callbacksManager.emit("onReady", {
      hasProfiles: state.profiles.length > 0,
      currentProfileId: current?.id ?? null,
      entityId,
    });
  }, [
    profilesInitialized,
    useProfilesStore,
    selectCurrentChatProfile,
    callbacksManager,
    entityId,
  ]);

  // Each page mounted under <Thread /> or <Settings /> declares its own
  // data dependencies via `useEnsureProfiles` / `useEnsureThreads` / etc.
  // The widget only gates render on `isReady` so migration finishes
  // before any page-level fetch fires.

  const { onNew, approveToolCall, denyToolCall } = useMessages({
    isReady,
  });

  // --- Imperative ref ---
  const callbacksRef = useRef<RefCallbacks>({
    onNew: () => {},
    approveToolCall: () => {},
    denyToolCall: () => {},
  });

  callbacksRef.current = {
    onNew: (text) => {
      void onNew({
        content: [{ type: "text", text }],
        parentId: null,
        sourceId: null,
        runConfig: undefined,
        role: "user",
        attachments: [],
        metadata: { custom: {} },
      } as unknown as AppendMessage);
    },
    approveToolCall: (allowAlways) => approveToolCall(allowAlways),
    denyToolCall,
  };

  const composerBridgeRef = useRef<ComposerBridge>({ setText: null });

  useImperativeHandle(
    widgetRef,
    () =>
      createWidgetRef(
        stores,
        selectCurrentChatProfile,
        callbacksRef,
        servers,
        eventBus,
        composerBridgeRef
      ),
    [stores, selectCurrentChatProfile, servers, eventBus]
  );

  // Reads the host's `platform.clouds` adapter, so a host-side failure would
  // otherwise surface as an unhandled rejection inside the widget. Report it
  // to the host and keep going with no cloud providers.
  useEffect(() => {
    void fetchClouds().catch((error) => {
      logger.error("clouds:fetch failed:", error);
      callbacksManager.emit("onError", {
        type: "network",
        error,
        context: "clouds:fetch",
      });
    });
  }, [fetchClouds, callbacksManager]);

  useEffect(() => {
    if (onMigrate) {
      onMigrate()
        .then(() => setIsReady(true))
        .catch((err) => {
          logger.error("Migration failed:", err);
          setIsReady(true);
        });
    } else {
      setIsReady(true);
    }
  }, [onMigrate]);

  if (!isReady) return null;

  return (
    <ComposerBridgeProvider bridgeRef={composerBridgeRef}>
      <Layout>{currentPage === "settings" ? <Settings /> : <Thread />}</Layout>
    </ComposerBridgeProvider>
  );
};
