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
import { CallbacksManager, ChatEventBus } from "./ui/events";
import type { ChatCallbacks } from "./ui/events";
import { MiddlewareRunner } from "./core/middleware";
import type { ChatMiddleware } from "./core/middleware";
import {
  AIEngine,
  AssignmentsEngine,
  PreferencesEngine,
  ProfilesEngine,
  PromptsEngine,
  ThreadsEngine,
  ToolsEngine,
  WebSearchEngine,
} from "./core/services";
import type { StorageAdapter } from "./core/storage";
import { PlatformProvider } from "./ui/platform/context";
import type { PlatformAdapter } from "./ui/platform/types";
import logger from "./shared/logger";
import type { SettingsAdapter } from "./shared/settings-adapter";
import { Layout } from "./ui/components/layout";
import { ManageToolDialog } from "./ui/components/manage-tool-dialog";
import { EventsProvider } from "./ui/events/context";
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
import { createServersDispatcher } from "./ui/tools/dispatcher";
import type { HostToolGroup } from "./ui/tools/types";
import { WidgetConfigProvider } from "./widget-config";
import type {
  ProviderType,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "./types";
import type { AIChatWidgetRef } from "./ui/imperative";
import { createWidgetRef, type RefCallbacks } from "./ui/imperative";
import useMessages from "./ui/hooks/useMessages";
import useProfiles from "./ui/hooks/useProfiles";
import useServers from "./ui/hooks/useServers";
import useThread from "./ui/hooks/useThreads";

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
  hostToolGroups?: HostToolGroup[];
  onMigrate?: () => Promise<void>;
  callbacks?: ChatCallbacks;
  middleware?: ChatMiddleware[];
  onlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
  hideProfilePicker?: boolean;
  hideSettingsButton?: boolean;
  onSettingsClick?: () => void;
  isSettingsActive?: boolean;
  isDialogFullscreen?: boolean;
  /** Optional remote API routing — defaults to in-process engines. */
  apiConfig?: Partial<Pick<ServerAPIConfig, "origin" | "baseUrl" | "headers">>;
}

export const AIChatWidget = React.forwardRef<
  AIChatWidgetRef,
  AIChatWidgetProps
>(
  (
    {
      storage,
      settings,
      platform,
      locale,
      translations,
      theme,
      customTheme,
      customThemes,
      storeKeys,
      components,
      images,
      hostToolGroups: hostToolGroupsProp,
      onMigrate,
      callbacks,
      middleware,
      onlyofficeConfig,
      hiddenProviders,
      hiddenWebSearchProviders,
      hideProfilePicker,
      hideSettingsButton,
      onSettingsClick,
      isSettingsActive,
      isDialogFullscreen,
      apiConfig,
    },
    ref
  ) => {
    const widgetConfig = useMemo(
      () => ({
        hideProfilePicker,
        hideSettingsButton,
        onSettingsClick,
        isSettingsActive,
        isDialogFullscreen,
      }),
      [
        hideProfilePicker,
        hideSettingsButton,
        onSettingsClick,
        isSettingsActive,
        isDialogFullscreen,
      ]
    );

    // Build AppContext + engines + ServerAPI for this widget instance
    const { ctx, stores, engines, serverApiConfig } = useMemo(() => {
      const eventBus = new ChatEventBus();
      const callbacksManager = new CallbacksManager();
      const middlewareRunner = new MiddlewareRunner(middleware ?? []);

      const assignments = new AssignmentsEngine({ storage });
      const profiles = new ProfilesEngine({ storage, assignments });
      const threads = new ThreadsEngine({ storage });
      const tools = new ToolsEngine({ storage });
      const prompts = new PromptsEngine({ storage });
      const webSearch = new WebSearchEngine({ storage });
      const preferences = new PreferencesEngine({ storage });

      const servers = new Servers(
        settings,
        platform,
        eventBus,
        assignments,
        callbacksManager
      );

      const ai = new AIEngine({
        storage,
        assignments,
        threads,
        toolDispatcher: createServersDispatcher(servers),
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
      const stores = createStores({ keys: storeKeys, ctx, api });

      return { ctx, stores, engines, serverApiConfig };
    }, [
      storage,
      settings,
      platform,
      storeKeys,
      middleware,
      onlyofficeConfig,
      hiddenProviders,
      hiddenWebSearchProviders,
      apiConfig,
    ]);

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
                      <ImagesProvider overrides={images}>
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
  const [isManageToolOpen, setIsManageToolOpen] = useState(false);

  const stores = useStores();
  const {
    useServersStore,
    useRouter,
    useCloudsStore,
    selectCurrentChatProfile,
  } = stores;

  const { currentPage } = useRouter();
  const { manageToolData, setManageToolData } = useServersStore();
  const { fetchClouds } = useCloudsStore();
  const { servers } = useToolsContext();

  useThread({ isReady });
  useServers({ isReady });
  useProfiles({ isReady });

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

  useImperativeHandle(
    widgetRef,
    () =>
      createWidgetRef(stores, selectCurrentChatProfile, callbacksRef, servers),
    [stores, selectCurrentChatProfile, servers]
  );

  useEffect(() => {
    if (manageToolData) setIsManageToolOpen(true);
  }, [manageToolData]);

  useEffect(() => {
    fetchClouds();
  }, [fetchClouds]);

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

  return (
    <Layout>
      {currentPage === "settings" ? <Settings /> : <Thread />}
      {isManageToolOpen ? (
        <ManageToolDialog
          onAllow={approveToolCall}
          onDeny={denyToolCall}
          onClose={() => {
            setIsManageToolOpen(false);
            setManageToolData(undefined);
          }}
        />
      ) : null}
    </Layout>
  );
};
