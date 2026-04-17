import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";
import { onlyOfficeInfo } from "../providers/onlyoffice/info";
import type { TCloudProvider } from "../types";

export interface CloudsStoreState {
  cloudProviders: TCloudProvider[];
  fetchClouds: () => Promise<void>;
}

const buildExternalOnlyofficeProvider = (
  ctx: AppContext
): TCloudProvider | null => {
  const cfg = ctx.onlyofficeConfig;
  if (!cfg?.baseUrl) return null;

  let label = onlyOfficeInfo.name;
  try {
    label = new URL(cfg.baseUrl).hostname;
  } catch {
    label = onlyOfficeInfo.name;
  }

  return {
    url: cfg.baseUrl,
    label,
    apiKey: cfg.apiKey,
  };
};

export function createCloudsStore(
  ctx: AppContext
): UseBoundStore<StoreApi<CloudsStoreState>> {
  const externalOnlyoffice = buildExternalOnlyofficeProvider(ctx);
  const initialProviders: TCloudProvider[] = externalOnlyoffice
    ? [externalOnlyoffice]
    : [];

  return create<CloudsStoreState>()((set) => ({
    cloudProviders: initialProviders,
    fetchClouds: async () => {
      if (!ctx.platform.clouds) {
        set({ cloudProviders: externalOnlyoffice ? [externalOnlyoffice] : [] });
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

      if (externalOnlyoffice) cloudProviders.unshift(externalOnlyoffice);

      set({ cloudProviders });
    },
  }));
}
