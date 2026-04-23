import { type AppendMessage } from "@assistant-ui/react";
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppContext } from "./app-context";
import { Layout } from "./components/layout";
import { ManageToolDialog } from "./components/manage-tool-dialog";
import type { StoreKeys } from "./config";
import { CallbacksManager } from "./events/callbacks";
import { ChatEventBus } from "./events/event-bus";
import { EventsProvider } from "./events/context";
import type { ChatCallbacks } from "./events/types";
import { MiddlewareRunner } from "./middleware";
import type { ChatMiddleware } from "./middleware";
import useMessages from "./hooks/useMessages";
import useProfiles from "./hooks/useProfiles";
import useServers from "./hooks/useServers";
import useThread from "./hooks/useThreads";
import { ComponentsProvider } from "./components-provider";
import type { ComponentOverrides } from "./components-provider";
import { ImagesProvider } from "./images-provider";
import type { ImageOverrides } from "./images-provider";
import { I18nProvider } from "./locales";
import type { Translations } from "./locales";
import logger from "./lib/logger";
import { ThemeProvider } from "./theme";
import type { ThemeTokens } from "./theme";
import Thread from "./pages/chat";

import Settings from "./pages/settings";
import { PlatformProvider } from "./platform/context";
import type { PlatformAdapter } from "./platform/types";
import Provider from "./providers";
import { setProviderInstance } from "./providers/provider-holder";
import { SettingsProvider } from "./settings/context";
import { setSettingsInstance } from "./settings/settings-holder";
import type { SettingsAdapter } from "./settings/types";
import { StorageProvider } from "./storage/context";
import { setStorageInstance } from "./storage/storage-holder";
import type { StorageAdapter } from "./storage/types";
import { StoresProvider, useStores } from "./store/context";
import { createStores } from "./store/create-stores";
import type {
  ProviderType,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "./types";
import { WidgetConfigProvider } from "./widget-config";
import { ToolsProvider, useToolsContext } from "./tools/context";
import Servers from "./tools/servers";
import { setServersInstance } from "./tools/tools-holder";
import type { HostToolGroup } from "./tools/types";
import type { AIChatWidgetRef } from "./imperative";
import { createWidgetRef, type RefCallbacks } from "./imperative";

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

    // Build AppContext — single DI container for this widget instance
    const { ctx, stores } = useMemo(() => {
      const provider = new Provider();
      provider.setSettings(settings);
      const eventBus = new ChatEventBus();
      const callbacksManager = new CallbacksManager();
      const servers = new Servers(
        settings,
        platform,
        eventBus,
        callbacksManager
      );
      const middlewareRunner = new MiddlewareRunner(middleware ?? []);

      const ctx: AppContext = {
        settings,
        storage,
        platform,
        provider,
        servers,
        eventBus,
        callbacksManager,
        middlewareRunner,
        onlyofficeConfig,
        hiddenProviders,
        hiddenWebSearchProviders,
      };

      // Deprecated: set global holders for backward compatibility
      setProviderInstance(provider);
      setSettingsInstance(settings);
      setStorageInstance(storage);
      setServersInstance(servers);

      const stores = createStores({ keys: storeKeys, ctx });

      return { ctx, stores };
    }, [
      settings,
      storage,
      platform,
      storeKeys,
      middleware,
      onlyofficeConfig,
      hiddenProviders,
      hiddenWebSearchProviders,
    ]);

    return (
      <EventsProvider
        callbacksManager={ctx.callbacksManager}
        callbacks={callbacks}
      >
        <SettingsProvider settings={settings}>
          <PlatformProvider platform={platform}>
            <I18nProvider locale={locale} translations={translations}>
              <ComponentsProvider overrides={components}>
                <WidgetConfigProvider config={widgetConfig}>
                  <StoresProvider stores={stores}>
                    <ThemeProvider
                      theme={theme}
                      customTheme={customTheme}
                      customThemes={customThemes}
                    >
                      <ImagesProvider overrides={images}>
                        <AppWithTools
                          storage={storage}
                          hostToolGroupsProp={hostToolGroupsProp}
                          onMigrate={onMigrate}
                          servers={ctx.servers}
                          eventBus={ctx.eventBus}
                          widgetRef={ref}
                        />
                      </ImagesProvider>
                    </ThemeProvider>
                  </StoresProvider>
                </WidgetConfigProvider>
              </ComponentsProvider>
            </I18nProvider>
          </PlatformProvider>
        </SettingsProvider>
      </EventsProvider>
    );
  }
);

AIChatWidget.displayName = "AIChatWidget";

/** Reads platform from context to build host tool groups, then wraps in ToolsProvider + StorageProvider */
const AppWithTools = ({
  storage,
  hostToolGroupsProp,
  onMigrate,
  servers,
  eventBus,
  widgetRef,
}: {
  storage: StorageAdapter;
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
      <StorageProvider storage={storage}>
        <AppInner onMigrate={onMigrate} widgetRef={widgetRef} />
      </StorageProvider>
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
