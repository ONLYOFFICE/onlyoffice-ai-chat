"use client";

import { useMemo } from "react";
import {
  EventsProvider,
  SettingsProvider,
  PlatformProvider,
  I18nProvider,
  ComponentsProvider,
  StoresProvider,
  ThemeProvider,
  ImagesProvider,
  ToolsProvider,
  StorageProvider,
  CallbacksManager,
  ChatEventBus,
  Servers,
  createStores,
  Provider,
  MiddlewareRunner,
} from "@onlyoffice/ai-chat";

import { settings } from "@/adapters/settings";
import { storage } from "@/adapters/storage";
import { platform } from "@/adapters/platform";
import { storeKeys } from "@/store-keys";

const isDark =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export default function Providers({ children }: { children: React.ReactNode }) {
  const { callbacksManager, eventBus, servers, stores } = useMemo(() => {
    const provider = new Provider();
    provider.setSettings(settings);

    const eventBus = new ChatEventBus();
    const servers = new Servers(settings, platform, eventBus);
    const callbacksManager = new CallbacksManager();
    const middlewareRunner = new MiddlewareRunner([]);

    const stores = createStores({
      keys: storeKeys,
      ctx: {
        settings,
        storage,
        platform,
        provider,
        servers,
        eventBus,
        callbacksManager,
        middlewareRunner,
      },
    });

    return { callbacksManager, eventBus, servers, stores };
  }, []);

  return (
    <EventsProvider callbacksManager={callbacksManager}>
      <SettingsProvider settings={settings}>
        <PlatformProvider platform={platform}>
          <I18nProvider locale={platform.env.locale}>
            <ComponentsProvider>
              <StoresProvider stores={stores}>
                <ThemeProvider
                  theme={isDark ? "theme-night" : "theme-white"}
                >
                  <ImagesProvider>
                    <ToolsProvider
                      hostToolGroups={[]}
                      servers={servers}
                      eventBus={eventBus}
                    >
                      <StorageProvider storage={storage}>
                        {children}
                      </StorageProvider>
                    </ToolsProvider>
                  </ImagesProvider>
                </ThemeProvider>
              </StoresProvider>
            </ComponentsProvider>
          </I18nProvider>
        </PlatformProvider>
      </SettingsProvider>
    </EventsProvider>
  );
}
