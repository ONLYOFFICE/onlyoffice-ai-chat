import type {
  CallbacksManager,
  ChatEventBus,
} from "./ui/providers/EventsProvider";
import type { MiddlewareRunner } from "./core/middleware";
import type { StorageAdapter } from "./core/storage";
import type { PlatformAdapter } from "./ui/providers/PlatformProvider/types";
import type Servers from "./ui/tools/servers";
import type {
  ProviderType,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "./types";

/**
 * Dependency injection container for a single AIChatWidget instance.
 * Replaces global singleton holders — each widget gets its own context,
 * enabling multiple independent instances on the same page.
 *
 * `storage` is the only persistence boundary — every core engine
 * receives it via {@link ServerAPIEngines}. Settings and the legacy
 * provider singleton are intentionally absent: settings live inside
 * `storage` (preferences / tool prefs / mcp servers), and the
 * provider is constructed per-action via `providerFor(profile)`.
 */
export interface AppContext {
  platform: PlatformAdapter;
  storage: StorageAdapter;
  servers: Servers;
  eventBus: ChatEventBus;
  callbacksManager: CallbacksManager;
  middlewareRunner: MiddlewareRunner;
  onlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
}
