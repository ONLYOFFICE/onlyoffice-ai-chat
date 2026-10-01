import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import type { ContextFolder, ContextRoom, RoomSkill } from "../../core/storage";
import type { ServerAPI } from "../providers/ApiProvider";
import logger from "../../shared/logger";
import type {
  ProviderType,
  TCloudProvider,
  TOnlyOfficeConfig,
  WebSearchProviderId,
} from "../../types";

export interface CloudsStoreState {
  cloudProviders: TCloudProvider[];
  externalOnlyofficeConfig?: TOnlyOfficeConfig;
  hiddenProviders?: ProviderType[];
  hiddenWebSearchProviders?: WebSearchProviderId[];
  fetchClouds: () => Promise<void>;
  /**
   * Rooms the user may add as context, grouped by cloud account — what
   * `StorageAdapter.getContextFolders` last returned (via `ContextEngine`).
   * Empty until fetched, when the host has no such method, or when the read
   * failed.
   */
  contextFolders: ContextFolder[];
  fetchContextFolders: () => Promise<void>;
  /**
   * The context room the user picked in the composer settings menu, with
   * the cloud it came from — `null` until one is chosen. Session state
   * only: it is not persisted and resets with the widget.
   */
  selectedContextFolder: SelectedContextFolder | null;
  /**
   * Pick a room and read its skills once. Re-picking the connected room is
   * a no-op — its skills and switches survive; only a new name is taken
   * over, so a room renamed while connected shows its current name. A
   * different room starts the skill list over with a fresh
   * `fetchRoomSkills`. A host that wants the list re-read later (the room
   * changed on its side) calls `fetchRoomSkills` itself; nothing in the
   * widget polls.
   */
  selectContextFolder: (cloud: string, room: ContextRoom) => void;
  clearContextFolder: () => void;
  /**
   * Skills of the connected room, as `StorageAdapter.getRoomSkills` last
   * returned them (via `ContextEngine`). Read once when the room is picked
   * and sent along with every round — the engine does not read them again.
   * Empty while no room is connected, until fetched, when the host has no
   * such method, or when the read failed.
   */
  roomSkills: RoomSkill[];
  fetchRoomSkills: () => Promise<void>;
  /**
   * Skills the user switched off for this session. Everything not listed
   * is on — a fresh room starts with every skill enabled.
   */
  disabledSkillIds: string[];
  setSkillEnabled: (skillId: string, enabled: boolean) => void;
}

export interface SelectedContextFolder {
  cloud: string;
  room: ContextRoom;
}

export interface CreateCloudsStoreConfig {
  ctx: AppContext;
  /**
   * Context reads go through the API bridge, not the storage adapter on
   * `ctx`: in server mode the browser holds a stub adapter and the real one
   * answers over HTTP. `platform.clouds` stays a direct read — it is always
   * client-side.
   */
  api: Pick<ServerAPI, "context">;
}

export function createCloudsStore({
  ctx,
  api,
}: CreateCloudsStoreConfig): UseBoundStore<StoreApi<CloudsStoreState>> {
  return create<CloudsStoreState>()((set, get) => ({
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
    contextFolders: [],
    fetchContextFolders: async () => {
      try {
        // The engine answers [] for a host without the method.
        const folders = await api.context.getContextFolders();
        // A cloud with no rooms has nothing to pick, so it never makes it
        // into the menu — callers may treat "empty list" as "hide the row".
        set({
          contextFolders: folders.filter((f) => f.rooms.length > 0),
        });
      } catch (error) {
        // A host-side failure must not take the settings menu down with it:
        // the row just stays hidden until the next fetch succeeds.
        logger.error("[clouds-store] getContextFolders failed", error);
        set({ contextFolders: [] });
      }
    },
    selectedContextFolder: null,
    selectContextFolder: (cloud, room) => {
      const current = get().selectedContextFolder;
      if (current?.cloud === cloud && current.room.id === room.id) {
        if (current.room.name !== room.name) {
          set({ selectedContextFolder: { cloud, room } });
        }
        return;
      }
      set({
        selectedContextFolder: { cloud, room },
        roomSkills: [],
        disabledSkillIds: [],
      });
      void get().fetchRoomSkills();
    },
    clearContextFolder: () => {
      set({
        selectedContextFolder: null,
        roomSkills: [],
        disabledSkillIds: [],
      });
    },
    roomSkills: [],
    fetchRoomSkills: async () => {
      const selected = get().selectedContextFolder;
      if (!selected) {
        set({ roomSkills: [] });
        return;
      }
      try {
        const skills = await api.context.getRoomSkills(
          selected.cloud,
          selected.room.id
        );
        // The user may have switched rooms while the read was in flight;
        // a late answer for the old room must not land on the new one.
        const current = get().selectedContextFolder;
        if (
          current?.cloud !== selected.cloud ||
          current.room.id !== selected.room.id
        ) {
          return;
        }
        // A switch for a skill the host no longer lists has nothing to hold.
        const ids = new Set(skills.map((skill) => skill.id));
        set({
          roomSkills: skills,
          disabledSkillIds: get().disabledSkillIds.filter((id) => ids.has(id)),
        });
      } catch (error) {
        logger.error("[clouds-store] getRoomSkills failed", error);
        set({ roomSkills: [] });
      }
    },
    disabledSkillIds: [],
    setSkillEnabled: (skillId, enabled) => {
      const { disabledSkillIds } = get();
      const without = disabledSkillIds.filter((id) => id !== skillId);
      set({ disabledSkillIds: enabled ? without : [...without, skillId] });
    },
  }));
}
