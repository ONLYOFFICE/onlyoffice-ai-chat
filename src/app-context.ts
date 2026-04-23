import type { CallbacksManager } from "./events/callbacks";
import type { ChatEventBus } from "./events/event-bus";
import type { MiddlewareRunner } from "./middleware";
import type { PlatformAdapter } from "./platform/types";
import type Provider from "./providers";
import type { SettingsAdapter } from "./settings/types";
import type { StorageAdapter } from "./storage/types";
import type Servers from "./tools/servers";
import type {
  ProviderType,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "./types";

/**
 * Dependency injection container for a single AIChatWidget instance.
 * Replaces global singleton holders — each widget gets its own context,
 * enabling multiple independent instances on the same page.
 */
export interface AppContext {
  settings: SettingsAdapter;
  storage: StorageAdapter;
  platform: PlatformAdapter;
  provider: Provider;
  servers: Servers;
  eventBus: ChatEventBus;
  callbacksManager: CallbacksManager;
  middlewareRunner: MiddlewareRunner;
  onlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
}
