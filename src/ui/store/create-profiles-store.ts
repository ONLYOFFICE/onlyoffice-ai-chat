import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import { ActionType } from "../../shared/action-type";
import logger from "../../shared/logger";
import { inferCapabilities } from "../../capabilities";
import type { StoreKeys } from "../../config";
import type { TErrorData } from "../../shared/error-data";
import type { ServerAPI } from "../providers/ApiProvider";
import type { ModelAssignmentTask } from "../providers/EventsProvider";
import type { Profile } from "../../types";

/**
 * Zustand state for AI provider profiles.
 *
 * A "profile" represents a configured AI provider + model pair (e.g.
 * "OpenAI / GPT-4o"). Profiles are assigned to task-specific action types
 * (chat, summarization, translation, etc.) via {@link ServerAPI.assignments}.
 */
export interface ProfilesStoreState {
  initialized: boolean;
  profiles: Profile[];
  defaultProfile: Profile | null;
  chatProfile: Profile | null;
  codeProfile: Profile | null;
  summarizationProfile: Profile | null;
  translationProfile: Profile | null;
  textAnalysisProfile: Profile | null;
  imageGenerationProfile: Profile | null;
  ocrProfile: Profile | null;
  visionProfile: Profile | null;
  sessionChatProfile: Profile | null;
  extendedThinking: boolean;
  init: () => Promise<void>;
  reloadProfiles: () => Promise<void>;
  reloadCurrentChat: () => Promise<void>;
  reloadModelAssignment: () => Promise<void>;
  addProfile: (
    data: Omit<Profile, "id">
  ) => Promise<boolean | TErrorData | undefined>;
  editProfile: (profile: Profile) => Promise<boolean | TErrorData | undefined>;
  deleteProfile: (id: string) => Promise<void>;
  getProfileById: (id: string) => Profile | null;
  getProfileByName: (name: string, ignoreCase?: boolean) => Profile | null;
  setDefaultProfile: (profile: Profile) => Promise<void>;
  setChatProfile: (profile: Profile | null) => Promise<void>;
  setCodeProfile: (profile: Profile | null) => Promise<void>;
  setSummarizationProfile: (profile: Profile | null) => Promise<void>;
  setTranslationProfile: (profile: Profile | null) => Promise<void>;
  setTextAnalysisProfile: (profile: Profile | null) => Promise<void>;
  setImageGenerationProfile: (profile: Profile | null) => Promise<void>;
  setOcrProfile: (profile: Profile | null) => Promise<void>;
  setVisionProfile: (profile: Profile | null) => Promise<void>;
  /**
   * Session-scoped chat profile pick (composer model picker, thread
   * open). `persistAssignment: true` — used by the composer's explicit
   * pick — additionally mirrors the pick into the persisted Chat
   * assignment, but only when the widget runs in the global scope (no
   * `entityId`); an entity-scoped widget keeps picks session-local.
   */
  setSessionChatProfile: (
    profile: Profile | null,
    opts?: { persistAssignment?: boolean }
  ) => void;
  toggleExtendedThinking: () => Promise<void>;
  reloadExtendedThinking: () => Promise<void>;
}

const FIELD_TO_ACTION = {
  chatProfile: ActionType.Chat,
  codeProfile: ActionType.Code,
  summarizationProfile: ActionType.Summarization,
  translationProfile: ActionType.Translation,
  textAnalysisProfile: ActionType.TextAnalyze,
  imageGenerationProfile: ActionType.ImageGeneration,
  ocrProfile: ActionType.OCR,
  visionProfile: ActionType.Vision,
} as const satisfies Partial<Record<keyof ProfilesStoreState, ActionType>>;

const TASK_FIELDS = Object.keys(FIELD_TO_ACTION) as Array<
  keyof typeof FIELD_TO_ACTION
>;

export function createProfilesStore(deps: {
  keys: StoreKeys;
  ctx: AppContext;
  api: ServerAPI;
  getEntityId?: () => string | undefined;
}): UseBoundStore<StoreApi<ProfilesStoreState>> {
  const { ctx, api, getEntityId } = deps;
  const entity = () => getEntityId?.();

  const backfillCapabilities = (profiles: Profile[]) => {
    for (const p of profiles) {
      if (p.capabilities === null || p.capabilities === undefined) {
        p.capabilities = inferCapabilities(p.providerType, p.modelId);
      }
    }
    return profiles;
  };

  const buildAssignmentsState = (
    profiles: Profile[],
    assignments: Record<string, string>
  ): Partial<ProfilesStoreState> => {
    const byId = new Map(profiles.map((p) => [p.id, p]));

    const lookup = (actionType: ActionType): Profile | null => {
      const id = assignments[actionType];
      return id ? (byId.get(id) ?? null) : null;
    };

    const next: Partial<ProfilesStoreState> = {
      defaultProfile: lookup(ActionType.Default),
    };
    for (const field of TASK_FIELDS) {
      next[field] = lookup(FIELD_TO_ACTION[field]);
    }
    return next;
  };

  const loadAssignmentsState = async (
    profiles: Profile[]
  ): Promise<Partial<ProfilesStoreState>> => {
    const assignments = await api.assignments.getAllAssignments(entity());
    return buildAssignmentsState(profiles, assignments);
  };

  const makeTaskSetter =
    (stateField: keyof typeof FIELD_TO_ACTION, task: ModelAssignmentTask) =>
    async (profile: Profile | null) => {
      const actionType = FIELD_TO_ACTION[stateField];
      if (profile) {
        await api.assignments.assign(actionType, profile.id);
      } else {
        await api.assignments.unassign(actionType);
      }
      set({ [stateField]: profile } as Partial<ProfilesStoreState>);
      ctx.callbacksManager.emit("onModelAssignmentUpdated", {
        task,
        profileId: profile?.id ?? null,
      });
    };

  let set: (
    partial:
      | Partial<ProfilesStoreState>
      | ((state: ProfilesStoreState) => Partial<ProfilesStoreState>)
  ) => void;

  // Coalesces concurrent `init()` calls: several page-level
  // `useEnsureProfiles` hooks (and the imperative ref) mount in the same
  // tick and each call `init()`, which fans out to three reads. While one
  // load is in flight the others share its promise; the guard clears on
  // settle so a later mount/navigation still re-syncs.
  let initInFlight: Promise<void> | null = null;

  const store = create<ProfilesStoreState>()((setState, get) => {
    set = setState;

    return {
      initialized: false,
      profiles: [],
      defaultProfile: null,
      chatProfile: null,
      codeProfile: null,
      summarizationProfile: null,
      translationProfile: null,
      textAnalysisProfile: null,
      imageGenerationProfile: null,
      ocrProfile: null,
      visionProfile: null,
      sessionChatProfile: null,
      extendedThinking: false,

      init: () => {
        if (initInFlight) return initInFlight;
        initInFlight = (async () => {
          try {
            // All three reads are independent — fan them out in one round
            // so the widget can hydrate in a single network/storage trip.
            const [rawProfiles, deepMode, assignments] = await Promise.all([
              api.profiles.list(),
              api.preferences.getDeepMode(entity()),
              api.assignments.getAllAssignments(entity()),
            ]);
            const profiles = backfillCapabilities(rawProfiles);
            const assignmentsState = buildAssignmentsState(
              profiles,
              assignments
            );
            set({
              profiles,
              extendedThinking: !!deepMode,
              initialized: true,
              ...assignmentsState,
            } as Partial<ProfilesStoreState>);
          } finally {
            initInFlight = null;
          }
        })();
        return initInFlight;
      },

      reloadProfiles: async () => {
        const profiles = backfillCapabilities(await api.profiles.list());
        set({ profiles });
      },

      reloadCurrentChat: async () => {
        const profiles = get().profiles;
        const assignments = await api.assignments.getAllAssignments(entity());
        const byId = new Map(profiles.map((p) => [p.id, p]));
        const chatId = assignments[ActionType.Chat];
        const defaultId = assignments[ActionType.Default];
        set({
          chatProfile: chatId ? (byId.get(chatId) ?? null) : null,
          defaultProfile: defaultId ? (byId.get(defaultId) ?? null) : null,
        });
      },

      reloadModelAssignment: async () => {
        const assignmentsState = await loadAssignmentsState(get().profiles);
        set(assignmentsState as Partial<ProfilesStoreState>);
      },

      addProfile: async (data) => {
        const result = await api.profiles.create(data);
        if (!result.success) return result.error;
        const profile = backfillCapabilities([result.profile])[0];
        const wasFirst = get().profiles.length === 0;
        set((state) => ({
          profiles: [profile, ...state.profiles],
          ...(wasFirst ? { defaultProfile: profile } : {}),
        }));
        ctx.callbacksManager.emit("onProfilesUpdated", {
          kind: "created",
          profile,
        });
        return true;
      },

      editProfile: async (profile) => {
        const result = await api.profiles.update(profile);
        if (!result.success) return result.error;
        backfillCapabilities([profile]);
        set((state) => {
          const update = (p: Profile | null) =>
            p?.id === profile.id ? profile : p;
          return {
            profiles: state.profiles.map((p) =>
              p.id === profile.id ? profile : p
            ),
            defaultProfile: update(state.defaultProfile),
            chatProfile: update(state.chatProfile),
            codeProfile: update(state.codeProfile),
            summarizationProfile: update(state.summarizationProfile),
            translationProfile: update(state.translationProfile),
            textAnalysisProfile: update(state.textAnalysisProfile),
            imageGenerationProfile: update(state.imageGenerationProfile),
            ocrProfile: update(state.ocrProfile),
            visionProfile: update(state.visionProfile),
            sessionChatProfile: update(state.sessionChatProfile),
          };
        });
        ctx.callbacksManager.emit("onProfilesUpdated", {
          kind: "updated",
          profile,
        });

        const fresh = get();
        const effective =
          fresh.sessionChatProfile ?? fresh.chatProfile ?? fresh.defaultProfile;
        if (effective?.id === profile.id) {
          const scope =
            fresh.sessionChatProfile?.id === profile.id
              ? "session"
              : "persisted";
          ctx.callbacksManager.emit("onCurrentChatProfileUpdated", {
            profileId: profile.id,
            scope,
            providerType: profile.providerType,
            modelId: profile.modelId,
          });
        }
        return true;
      },

      deleteProfile: async (id) => {
        await api.profiles.delete(id);
        ctx.callbacksManager.emit("onProfilesUpdated", {
          kind: "deleted",
          profileId: id,
        });

        const profiles = get().profiles.filter((p) => p.id !== id);
        const assignmentsState = await loadAssignmentsState(profiles);
        set((state) => ({
          profiles,
          sessionChatProfile:
            state.sessionChatProfile?.id === id
              ? null
              : state.sessionChatProfile,
          ...assignmentsState,
        }));
      },

      getProfileById: (id) => get().profiles.find((p) => p.id === id) ?? null,

      getProfileByName: (name, ignoreCase) =>
        get().profiles.find((p) =>
          ignoreCase
            ? p.name.toLowerCase() === name.toLowerCase()
            : p.name === name
        ) ?? null,

      setDefaultProfile: async (profile) => {
        await api.assignments.assign(ActionType.Default, profile.id);
        set({ defaultProfile: profile });
        ctx.callbacksManager.emit("onModelAssignmentUpdated", {
          task: "default",
          profileId: profile?.id ?? null,
        });
      },

      setChatProfile: async (profile) => {
        if (profile) {
          await api.assignments.assign(ActionType.Chat, profile.id);
        } else {
          await api.assignments.unassign(ActionType.Chat);
        }
        set({ chatProfile: profile });
        ctx.callbacksManager.emit("onModelAssignmentUpdated", {
          task: "chat",
          profileId: profile?.id ?? null,
        });
        ctx.callbacksManager.emit("onCurrentChatProfileUpdated", {
          profileId: profile?.id ?? null,
          scope: "persisted",
          providerType: profile?.providerType,
          modelId: profile?.modelId,
        });
      },

      setCodeProfile: makeTaskSetter("codeProfile", "code"),

      setSummarizationProfile: makeTaskSetter(
        "summarizationProfile",
        "summarization"
      ),
      setTranslationProfile: makeTaskSetter(
        "translationProfile",
        "translation"
      ),
      setTextAnalysisProfile: makeTaskSetter(
        "textAnalysisProfile",
        "textAnalysis"
      ),
      setImageGenerationProfile: makeTaskSetter(
        "imageGenerationProfile",
        "imageGeneration"
      ),
      setOcrProfile: makeTaskSetter("ocrProfile", "ocr"),
      setVisionProfile: makeTaskSetter("visionProfile", "vision"),

      setSessionChatProfile: (profile, opts) => {
        set({ sessionChatProfile: profile });
        ctx.callbacksManager.emit("onCurrentChatProfileUpdated", {
          profileId: profile?.id ?? null,
          scope: "session",
          providerType: profile?.providerType,
          modelId: profile?.modelId,
        });
        // Mirror an explicit composer pick into the persisted Chat
        // assignment — global scope only: with an `entityId` the pick
        // stays session-local so an entity-scoped widget never rewrites
        // the global assignment. Fire-and-forget: the session switch
        // above is already applied and must not wait on (or be undone
        // by) the persistence write.
        if (opts?.persistAssignment && profile && !entity()) {
          void get()
            .setChatProfile(profile)
            .catch((e) =>
              logger.error("Failed to persist chat model assignment:", e)
            );
        }
      },

      toggleExtendedThinking: async () => {
        const next = !get().extendedThinking;
        await api.preferences.setDeepMode(next, entity());
        set({ extendedThinking: next });
        ctx.callbacksManager.emit("onExtendedThinkingUpdated", {
          enabled: next,
        });
      },

      reloadExtendedThinking: async () => {
        const next = !!(await api.preferences.getDeepMode(entity()));
        if (get().extendedThinking === next) return;
        set({ extendedThinking: next });
        ctx.callbacksManager.emit("onExtendedThinkingUpdated", {
          enabled: next,
        });
      },
    };
  });

  return store;
}
