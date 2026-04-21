import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";
import { ActionType, inferCapabilities } from "../capabilities";
import type { StoreKeys } from "../config";
import type { ModelAssignmentTask } from "../events/types";
import type { TErrorData } from "../providers/base";
import {
  applyProfileToAction,
  initActionHolders,
} from "../services/action-holders";
import type { ProfilesService } from "../services/profiles";
import type { Profile } from "../types";

/**
 * Zustand state for AI provider profiles.
 *
 * A "profile" represents a configured AI provider + model pair (e.g.
 * "OpenAI / GPT-4o"). Profiles are assigned to task-specific action types
 * (chat, summarization, translation, etc.) and persisted via settings.
 */
export interface ProfilesStoreState {
  /** All saved profiles. */
  profiles: Profile[];
  /** The fallback profile used when no task-specific profile is assigned. */
  defaultProfile: Profile | null;
  /** Profile assigned to the Chat action type. */
  chatProfile: Profile | null;
  /** Profile assigned to the Summarization action type. */
  summarizationProfile: Profile | null;
  /** Profile assigned to the Translation action type. */
  translationProfile: Profile | null;
  /** Profile assigned to the Text Analysis action type. */
  textAnalysisProfile: Profile | null;
  /** Profile assigned to the Image Generation action type. */
  imageGenerationProfile: Profile | null;
  /** Profile assigned to the OCR action type. */
  ocrProfile: Profile | null;
  /** Profile assigned to the Vision action type. */
  visionProfile: Profile | null;
  /** Temporary per-session chat profile override (not persisted). */
  sessionChatProfile: Profile | null;
  /** Whether extended / deep thinking mode is enabled. */
  extendedThinking: boolean;
  /** Load all profiles and task assignments from storage. */
  init: () => Promise<void>;
  /** Re-read all profiles from storage without touching task assignments or session override. */
  reloadProfiles: () => Promise<void>;
  /** Re-read the persisted chat profile from settings and re-apply it. */
  reloadCurrentChat: () => void;
  /** Re-read all task profile assignments (default + 7 tasks) from settings and re-apply. */
  reloadModelAssignment: () => void;
  /** Create and persist a new profile. Returns `true` on success or error data on failure. */
  addProfile: (
    data: Omit<Profile, "id">
  ) => Promise<boolean | TErrorData | undefined>;
  /** Update an existing profile and propagate changes to all task assignments. */
  editProfile: (profile: Profile) => Promise<boolean | TErrorData | undefined>;
  /** Delete a profile by ID and clear any task assignments that reference it. */
  deleteProfile: (id: string) => Promise<void>;
  /** Look up a profile by its unique ID. */
  getProfileById: (id: string) => Profile | null;
  /** Look up a profile by display name, optionally case-insensitive. */
  getProfileByName: (name: string, ignoreCase?: boolean) => Profile | null;
  /** Set the default (fallback) profile and persist the choice. */
  setDefaultProfile: (profile: Profile) => void;
  /** Assign a profile to the Chat action type and update the active provider. */
  setChatProfile: (profile: Profile | null) => void;
  /** Assign a profile to the Summarization action type. */
  setSummarizationProfile: (profile: Profile | null) => void;
  /** Assign a profile to the Translation action type. */
  setTranslationProfile: (profile: Profile | null) => void;
  /** Assign a profile to the Text Analysis action type. */
  setTextAnalysisProfile: (profile: Profile | null) => void;
  /** Assign a profile to the Image Generation action type. */
  setImageGenerationProfile: (profile: Profile | null) => void;
  /** Assign a profile to the OCR action type. */
  setOcrProfile: (profile: Profile | null) => void;
  /** Assign a profile to the Vision action type. */
  setVisionProfile: (profile: Profile | null) => void;
  /** Set a temporary session-scoped chat profile override (cleared on thread switch). */
  setSessionChatProfile: (profile: Profile | null) => void;
  /** Toggle extended / deep thinking mode on or off and persist the setting. */
  toggleExtendedThinking: () => void;
}

export function createProfilesStore(deps: {
  keys: StoreKeys;
  profilesService: ProfilesService;
  ctx: AppContext;
}): UseBoundStore<StoreApi<ProfilesStoreState>> {
  const { keys, profilesService, ctx } = deps;

  const TASK_PROFILE_KEYS = [
    keys.chatProfile,
    keys.summarizationProfile,
    keys.translationProfile,
    keys.textAnalysisProfile,
    keys.imageGenerationProfile,
    keys.ocrProfile,
    keys.visionProfile,
  ] as const;

  const TASK_FIELD_MAP: Record<string, keyof ProfilesStoreState> = {
    [keys.chatProfile]: "chatProfile",
    [keys.summarizationProfile]: "summarizationProfile",
    [keys.translationProfile]: "translationProfile",
    [keys.textAnalysisProfile]: "textAnalysisProfile",
    [keys.imageGenerationProfile]: "imageGenerationProfile",
    [keys.ocrProfile]: "ocrProfile",
    [keys.visionProfile]: "visionProfile",
  };

  const FIELD_TO_ACTION: Record<string, ActionType> = {
    chatProfile: ActionType.Chat,
    summarizationProfile: ActionType.Summarization,
    translationProfile: ActionType.Translation,
    textAnalysisProfile: ActionType.TextAnalyze,
    imageGenerationProfile: ActionType.ImageGeneration,
    ocrProfile: ActionType.OCR,
    visionProfile: ActionType.Vision,
  };

  const applyAllActionHolders = (state: {
    defaultProfile: Profile | null;
    chatProfile: Profile | null;
    summarizationProfile: Profile | null;
    translationProfile: Profile | null;
    textAnalysisProfile: Profile | null;
    imageGenerationProfile: Profile | null;
    ocrProfile: Profile | null;
    visionProfile: Profile | null;
  }) => {
    for (const [field, actionType] of Object.entries(FIELD_TO_ACTION)) {
      applyProfileToAction(
        actionType,
        state[field as keyof typeof state],
        state.defaultProfile
      );
    }
  };

  const makeTaskSetter =
    (
      settingsKey: string,
      stateField: keyof ProfilesStoreState,
      actionType: ActionType,
      task: ModelAssignmentTask
    ) =>
    (profile: Profile | null) => {
      profilesService.setTaskProfile(settingsKey, profile);
      set({ [stateField]: profile } as Partial<ProfilesStoreState>);
      const state = store.getState();
      applyProfileToAction(actionType, profile, state.defaultProfile);
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

  const store = create<ProfilesStoreState>()((setState, get) => {
    set = setState;

    return {
      profiles: [],
      defaultProfile: null,
      chatProfile: null,
      summarizationProfile: null,
      translationProfile: null,
      textAnalysisProfile: null,
      imageGenerationProfile: null,
      ocrProfile: null,
      visionProfile: null,
      sessionChatProfile: null,

      extendedThinking: (() => {
        try {
          const saved = ctx.settings.get(keys.deepMode);
          if (!saved) return false;
          return JSON.parse(saved);
        } catch {
          return false;
        }
      })(),

      init: async () => {
        const { profiles, defaultProfile, taskProfiles } =
          await profilesService.init({
            defaultKey: keys.defaultProfile,
            taskKeys: [...TASK_PROFILE_KEYS],
          });

        // Backfill capabilities for profiles created before this feature
        for (const p of profiles) {
          if (p.capabilities === null || p.capabilities === undefined) {
            p.capabilities = inferCapabilities(p.providerType, p.modelId);
          }
        }

        const state: Record<string, unknown> = { profiles, defaultProfile };
        for (const key of TASK_PROFILE_KEYS) {
          state[TASK_FIELD_MAP[key]] = taskProfiles[key] ?? null;
        }
        set(state as Partial<ProfilesStoreState>);

        profilesService.applyCurrentChatProvider(
          null,
          taskProfiles[keys.chatProfile] ?? null,
          defaultProfile
        );

        // Initialize action holders for all task types
        initActionHolders();
        applyAllActionHolders(get());
      },

      reloadProfiles: async () => {
        const { profiles } = await profilesService.init({
          defaultKey: keys.defaultProfile,
          taskKeys: [...TASK_PROFILE_KEYS],
        });
        for (const p of profiles) {
          if (p.capabilities === null || p.capabilities === undefined) {
            p.capabilities = inferCapabilities(p.providerType, p.modelId);
          }
        }
        set({ profiles });
      },

      reloadCurrentChat: () => {
        const { profiles } = get();
        // The effective chat profile is `session ?? chat ?? default`, so to
        // re-sync it after an external storage mutation we must re-read both
        // the chat slot and the default slot — otherwise a change to the
        // default profile (while the chat slot is unset) is invisible here.
        const chatProfile = profilesService.loadProfileById(
          profiles,
          keys.chatProfile
        );
        const defaultProfile = profilesService.loadProfileById(
          profiles,
          keys.defaultProfile
        );
        set((state) => {
          profilesService.applyCurrentChatProvider(
            state.sessionChatProfile,
            chatProfile,
            defaultProfile
          );
          return { chatProfile, defaultProfile };
        });
        applyProfileToAction(ActionType.Chat, chatProfile, defaultProfile);
      },

      reloadModelAssignment: () => {
        const { profiles } = get();
        const defaultProfile = profilesService.loadProfileById(
          profiles,
          keys.defaultProfile
        );
        const nextState: Record<string, unknown> = { defaultProfile };
        for (const key of TASK_PROFILE_KEYS) {
          nextState[TASK_FIELD_MAP[key]] =
            profilesService.loadProfileById(profiles, key) ?? null;
        }
        set(nextState as Partial<ProfilesStoreState>);

        const fresh = get();
        profilesService.applyCurrentChatProvider(
          fresh.sessionChatProfile,
          fresh.chatProfile,
          fresh.defaultProfile
        );
        applyAllActionHolders(fresh);
      },

      addProfile: async (data) => {
        const result = await profilesService.addProfile(data, get().profiles);
        if (result.success) {
          const isFirst = get().profiles.length === 0;
          set((state) => ({
            profiles: [result.profile, ...state.profiles],
          }));
          if (isFirst) get().setDefaultProfile(result.profile);
          ctx.callbacksManager.emit("onProfileCreated", {
            profile: result.profile,
          });
          ctx.callbacksManager.emit("onProfilesUpdated", {
            kind: "created",
            profileId: result.profile.id,
          });
          return true;
        }
        return result.error;
      },

      editProfile: async (profile) => {
        const result = await profilesService.editProfile(
          profile,
          get().profiles
        );
        if (!result.success) return result.error;

        set((state) => {
          const profiles = state.profiles.map((p) =>
            p.id === profile.id ? profile : p
          );
          const updateIfMatch = (p: Profile | null) =>
            p?.id === profile.id ? profile : p;

          const defaultProfile = updateIfMatch(state.defaultProfile);
          const chatProfile = updateIfMatch(state.chatProfile);
          const summarizationProfile = updateIfMatch(
            state.summarizationProfile
          );
          const translationProfile = updateIfMatch(state.translationProfile);
          const textAnalysisProfile = updateIfMatch(state.textAnalysisProfile);
          const imageGenerationProfile = updateIfMatch(
            state.imageGenerationProfile
          );
          const ocrProfile = updateIfMatch(state.ocrProfile);
          const visionProfile = updateIfMatch(state.visionProfile);
          const sessionChatProfile = updateIfMatch(state.sessionChatProfile);

          profilesService.applyCurrentChatProvider(
            sessionChatProfile,
            chatProfile,
            defaultProfile
          );

          const updated = {
            profiles,
            defaultProfile,
            chatProfile,
            summarizationProfile,
            translationProfile,
            textAnalysisProfile,
            imageGenerationProfile,
            ocrProfile,
            visionProfile,
            sessionChatProfile,
          };

          applyAllActionHolders(updated);

          return updated;
        });
        ctx.callbacksManager.emit("onProfileUpdated", { profile });
        ctx.callbacksManager.emit("onProfilesUpdated", {
          kind: "updated",
          profileId: profile.id,
        });

        // If the edited profile backs the current effective chat profile
        // (session > chat > default fallback), notify consumers that the
        // effective chat provider/model may have changed.
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
        await profilesService.deleteProfile(id);
        ctx.callbacksManager.emit("onProfileDeleted", { profileId: id });
        ctx.callbacksManager.emit("onProfilesUpdated", {
          kind: "deleted",
          profileId: id,
        });
        set((state) => {
          const profiles = state.profiles.filter((p) => p.id !== id);

          const cleared: Partial<ProfilesStoreState> = {};
          for (const [key, field] of Object.entries(TASK_FIELD_MAP)) {
            (cleared as Record<string, unknown>)[field] =
              profilesService.clearTaskProfileIfMatch(
                state[field] as Profile | null,
                id,
                key
              );
          }

          const sessionChatProfile =
            state.sessionChatProfile?.id === id
              ? null
              : state.sessionChatProfile;

          const defaultProfile = profilesService.reassignDefault(
            profiles,
            id,
            state.defaultProfile,
            keys.defaultProfile
          );

          profilesService.applyCurrentChatProvider(
            sessionChatProfile,
            cleared.chatProfile ?? null,
            defaultProfile
          );

          const updated = {
            profiles,
            defaultProfile,
            ...cleared,
            sessionChatProfile,
          };

          applyAllActionHolders(updated as typeof state & typeof updated);

          return updated;
        });
      },

      getProfileById: (id) => get().profiles.find((p) => p.id === id) ?? null,

      getProfileByName: (name, ignoreCase) =>
        get().profiles.find((p) =>
          ignoreCase
            ? p.name.toLowerCase() === name.toLowerCase()
            : p.name === name
        ) ?? null,

      setDefaultProfile: (profile) => {
        profilesService.setTaskProfile(keys.defaultProfile, profile);
        set((state) => {
          profilesService.applyCurrentChatProvider(
            state.sessionChatProfile,
            state.chatProfile,
            profile
          );
          return { defaultProfile: profile };
        });
        applyAllActionHolders(store.getState());
        ctx.callbacksManager.emit("onModelAssignmentUpdated", {
          task: "default",
          profileId: profile?.id ?? null,
        });
      },

      setChatProfile: (profile) => {
        profilesService.setTaskProfile(keys.chatProfile, profile);
        set((state) => {
          profilesService.applyCurrentChatProvider(
            state.sessionChatProfile,
            profile,
            state.defaultProfile
          );
          return { chatProfile: profile };
        });
        applyProfileToAction(
          ActionType.Chat,
          profile,
          store.getState().defaultProfile
        );
        if (profile) {
          ctx.callbacksManager.emit("onProfileChanged", {
            profileId: profile.id,
            providerType: profile.providerType,
            modelId: profile.modelId,
          });
        }
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

      setSummarizationProfile: makeTaskSetter(
        keys.summarizationProfile,
        "summarizationProfile",
        ActionType.Summarization,
        "summarization"
      ),
      setTranslationProfile: makeTaskSetter(
        keys.translationProfile,
        "translationProfile",
        ActionType.Translation,
        "translation"
      ),
      setTextAnalysisProfile: makeTaskSetter(
        keys.textAnalysisProfile,
        "textAnalysisProfile",
        ActionType.TextAnalyze,
        "textAnalysis"
      ),
      setImageGenerationProfile: makeTaskSetter(
        keys.imageGenerationProfile,
        "imageGenerationProfile",
        ActionType.ImageGeneration,
        "imageGeneration"
      ),
      setOcrProfile: makeTaskSetter(
        keys.ocrProfile,
        "ocrProfile",
        ActionType.OCR,
        "ocr"
      ),
      setVisionProfile: makeTaskSetter(
        keys.visionProfile,
        "visionProfile",
        ActionType.Vision,
        "vision"
      ),

      setSessionChatProfile: (profile) => {
        set((state) => {
          profilesService.applyCurrentChatProvider(
            profile,
            state.chatProfile,
            state.defaultProfile
          );
          return { sessionChatProfile: profile };
        });
        ctx.callbacksManager.emit("onCurrentChatProfileUpdated", {
          profileId: profile?.id ?? null,
          scope: "session",
          providerType: profile?.providerType,
          modelId: profile?.modelId,
        });
      },

      toggleExtendedThinking: () => {
        set((state) => {
          const next = !state.extendedThinking;
          ctx.settings.set(keys.deepMode, JSON.stringify(next));
          return { extendedThinking: next };
        });
      },
    };
  });

  return store;
}
