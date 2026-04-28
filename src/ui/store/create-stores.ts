import type { StoreApi, UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import type { StoreKeys } from "../../config";
import type { CallbacksManager } from "../events";
import type { MiddlewareRunner } from "../../core/middleware";
import type { ServerAPI } from "../providers/ApiProvider";
import {
  type AttachmentsStoreState,
  createAttachmentsStore,
} from "./create-attachments-store";
import {
  type CloudsStoreState,
  createCloudsStore,
} from "./create-clouds-store.ts";
import {
  createMessageStore,
  type MessageStoreState,
} from "./create-message-store";
import {
  createProfilesStore,
  type ProfilesStoreState,
} from "./create-profiles-store";
import {
  createPromptsStore,
  type PromptsStoreState,
} from "./create-prompts-store";
import {
  createRouterStore,
  type RouterStoreState,
} from "./create-router-store";
import {
  createServersStore,
  type ServersStoreState,
} from "./create-servers-store";
import { createThemeStore, type ThemeStoreState } from "./create-theme-store";
import {
  createThreadsStore,
  type ThreadsStoreState,
} from "./create-threads-store";

export type { AttachmentsStoreState } from "./create-attachments-store";
export type { CloudsStoreState } from "./create-clouds-store";
export type { MessageStoreState } from "./create-message-store";
export type { ProfilesStoreState } from "./create-profiles-store";
export type { PromptsStoreState } from "./create-prompts-store";
export type { Page, RouterStoreState } from "./create-router-store";
export type { ServersStoreState } from "./create-servers-store";
export type { ThemeStoreState } from "./create-theme-store";
export type { ThreadsStoreState } from "./create-threads-store";

import type { Profile } from "../../types";

/**
 * Bundle of all Zustand store hooks and shared selectors that make up the
 * runtime state of a single AI chat widget instance.
 *
 * Created once per widget via {@link createStores} and distributed through
 * React context so every component can access any slice of state.
 */
export interface Stores {
  useMessageStore: UseBoundStore<StoreApi<MessageStoreState>>;
  useProfilesStore: UseBoundStore<StoreApi<ProfilesStoreState>>;
  useThreadsStore: UseBoundStore<StoreApi<ThreadsStoreState>>;
  useServersStore: UseBoundStore<StoreApi<ServersStoreState>>;
  usePromptsStore: UseBoundStore<StoreApi<PromptsStoreState>>;
  useAttachmentsStore: UseBoundStore<StoreApi<AttachmentsStoreState>>;
  useThemeStore: UseBoundStore<StoreApi<ThemeStoreState>>;
  useRouter: UseBoundStore<StoreApi<RouterStoreState>>;
  useCloudsStore: UseBoundStore<StoreApi<CloudsStoreState>>;
  callbacksManager: CallbacksManager;
  middlewareRunner: MiddlewareRunner;
  api: ServerAPI;
  selectCurrentChatProfile: (s: ProfilesStoreState) => Profile | null;
}

export interface CreateStoresConfig {
  keys: StoreKeys;
  ctx: AppContext;
  api: ServerAPI;
}

/**
 * Factory that creates a complete, self-contained set of Zustand stores for
 * one AI chat widget instance.
 *
 * Each call produces an independent {@link Stores} bundle with its own
 * stores -- allowing multiple widget instances to coexist without shared
 * mutable state.
 */
export function createStores(config: CreateStoresConfig): Stores {
  const { keys, ctx, api } = config;

  const useMessageStore = createMessageStore({ ctx, api });
  const useProfilesStore = createProfilesStore({ keys, ctx, api });
  const useThreadsStore = createThreadsStore({
    api,
    platform: ctx.platform,
    useProfilesStore,
    useMessageStore,
    callbacksManager: ctx.callbacksManager,
  });
  const useServersStore = createServersStore({
    ctx,
    api,
    callbacksManager: ctx.callbacksManager,
  });
  const usePromptsStore = createPromptsStore({ api });
  const useAttachmentsStore = createAttachmentsStore();
  const useThemeStore = createThemeStore(ctx);
  const useRouter = createRouterStore();
  const useCloudsStore = createCloudsStore(ctx);

  const selectCurrentChatProfile = (s: ProfilesStoreState) =>
    s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

  return {
    useMessageStore,
    useProfilesStore,
    useThreadsStore,
    useServersStore,
    usePromptsStore,
    useAttachmentsStore,
    useThemeStore,
    useRouter,
    useCloudsStore,
    callbacksManager: ctx.callbacksManager,
    middlewareRunner: ctx.middlewareRunner,
    api,
    selectCurrentChatProfile,
  };
}
