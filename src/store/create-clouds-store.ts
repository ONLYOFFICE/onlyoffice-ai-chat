import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";
import type {
  ProviderType,
  TCloudProvider,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "../types";

export interface CloudsStoreState {
  cloudProviders: TCloudProvider[];
  externalOnlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
  fetchClouds: () => Promise<void>;
}

export function createCloudsStore(
  ctx: AppContext
): UseBoundStore<StoreApi<CloudsStoreState>> {
  return create<CloudsStoreState>()((set) => ({
    cloudProviders: [],
    externalOnlyofficeConfig: ctx.onlyofficeConfig,
    hiddenProviders: ctx.hiddenProviders,
    hiddenWebSearchProviders: ctx.hiddenWebSearchProviders,
    fetchClouds: async () => {
      if (!ctx.platform.clouds) {
        set({ cloudProviders: [] });
        return;
      }

      const clouds = await ctx.platform.clouds.getClouds();
      const cloudKeys = ctx.platform.clouds.getCloudKeys();

      const cloudProviders = clouds.reduce<TCloudProvider[]>((acc, cloud) => {
        const key = cloudKeys.find((k) => k.url === cloud.portal);
        const apiKey = key?.keys[0]?.value;

        if (apiKey) {
          acc.push({
            url: cloud.portal,
            label: new URL(cloud.portal).hostname,
            apiKey,
          });
        }

        return acc;
      }, []);

      set({ cloudProviders });
    },
  }));
}
