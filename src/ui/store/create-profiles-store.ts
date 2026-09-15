import { create, type StoreApi, type UseBoundStore } from "zustand";
import i18n from "i18next";
import type { AppContext } from "../../app-context";
import { ActionType } from "../../shared/action-type";
import logger from "../../shared/logger";
import {
  DEFAULT_REASONING_LEVEL,
  type ReasoningLevel,
} from "../../shared/reasoning-level";
import { inferCapabilities } from "../../capabilities";
import type { StoreKeys } from "../../config";
import type { TErrorData } from "../../shared/error-data";
import type { ServerAPI } from "../providers/ApiProvider";
import { isRouteUnavailable } from "../providers/ApiProvider/fetcher";
import type { ModelAssignmentTask } from "../providers/EventsProvider";
import type { Profile } from "../../types";
import {
  defaultReasoningDepth,
  resolveProfileReasoningSupport,
} from "./profile-reasoning-support";
import { reportStoreError } from "./report-error";

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
  /** Whether extended thinking is on — `reasoningLevel !== "off"`. */
  extendedThinking: boolean;
  /** Effective extended-thinking depth; `"off"` while the toggle is off. */
  reasoningLevel: ReasoningLevel;
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
  /**
   * Flip extended thinking. Off → on restores the depth that was active
   * last (this session, then whatever the host persisted), never a fixed
   * one.
   */
  toggleExtendedThinking: () => Promise<void>;
  /** Set the extended-thinking depth; `"off"` turns the toggle off. */
  setReasoningLevel: (level: ReasoningLevel) => Promise<void>;
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

  // Depth to restore when the toggle goes off → on. Seeded from the host on
  // init and refreshed on every explicit pick, so a user who chose "high",
  // switched off and back on gets "high" again — not the default.
  let lastDepth: Exclude<ReasoningLevel, "off"> = DEFAULT_REASONING_LEVEL;
  const rememberDepth = (level: ReasoningLevel) => {
    if (level !== "off") lastDepth = level;
  };

  // A host built before the depth existed serves only the boolean routes:
  // its `get-reasoning-level` is a 404. Fall back to deep mode and stop
  // asking for the rest of this store's life — one warning, not one per
  // round. Only an "unavailable" answer counts; a transient failure is
  // rethrown like any other, so a flaky network never downgrades the host.
  let levelRouteMissing = false;
  const readLevel = async (): Promise<ReasoningLevel> => {
    if (!levelRouteMissing) {
      try {
        return await api.preferences.getReasoningLevel(entity());
      } catch (error) {
        if (!isRouteUnavailable(error)) throw error;
        levelRouteMissing = true;
        logger.warn(
          "Reasoning level is not served by the host; falling back to deep mode:",
          error
        );
      }
    }
    const deep = await api.preferences.getDeepMode(entity());
    return deep ? lastDepth : "off";
  };
  const writeLevel = async (level: ReasoningLevel): Promise<void> => {
    if (!levelRouteMissing) {
      try {
        await api.preferences.setReasoningLevel(level, entity());
        return;
      } catch (error) {
        if (!isRouteUnavailable(error)) throw error;
        levelRouteMissing = true;
        logger.warn(
          "Reasoning level is not served by the host; persisting deep mode only:",
          error
        );
      }
    }
    await api.preferences.setDeepMode(level !== "off", entity());
  };
  const applyLevel = (level: ReasoningLevel) => {
    rememberDepth(level);
    set({ reasoningLevel: level, extendedThinking: level !== "off" });
    ctx.callbacksManager.emit("onExtendedThinkingUpdated", {
      enabled: level !== "off",
      level,
    });
  };

  /**
   * A new chat model starts at its own default depth — the catalogue's
   * `default_effort` where the provider reports one, else the standard
   * depth, clamped to what the model distinguishes — rather than inheriting
   * whatever the previous model ran at (`max` on one may not exist on the
   * next, and a model that cannot stop must not sit on Off). An Off the user
   * chose survives on a model that can be switched off. Applied at once so
   * the composer follows the pick; the write to the host trails behind and
   * is only logged when it fails, as the assignment write is.
   */
  const adoptModelDefault = (
    previous: Profile | null,
    next: Profile | null
  ) => {
    if (!next) return;
    if (previous?.id === next.id && previous.modelId === next.modelId) return;
    const support = resolveProfileReasoningSupport(next);
    const depth = defaultReasoningDepth(support);
    if (!depth) return;
    const current = store.getState().reasoningLevel;
    if (current === "off" && support.canDisable) return;
    if (current === depth) return;
    applyLevel(depth);
    void writeLevel(depth).catch((e) =>
      logger.error("Failed to persist the model's default reasoning depth:", e)
    );
  };
  const currentChat = (s: ProfilesStoreState) =>
    s.sessionChatProfile ?? s.chatProfile ?? s.defaultProfile;

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
      reasoningLevel: "off",

      init: () => {
        if (initInFlight) return initInFlight;
        initInFlight = (async () => {
          try {
            // All three reads are independent — fan them out in one round
            // so the widget can hydrate in a single network/storage trip.
            const [rawProfiles, reasoningLevel, assignments] =
              await Promise.all([
                api.profiles.list(),
                readLevel(),
                api.assignments.getAllAssignments(entity()),
              ]);
            rememberDepth(reasoningLevel);
            const profiles = backfillCapabilities(rawProfiles);
            const assignmentsState = buildAssignmentsState(
              profiles,
              assignments
            );
            set({
              profiles,
              reasoningLevel,
              extendedThinking: reasoningLevel !== "off",
              initialized: true,
              ...assignmentsState,
            } as Partial<ProfilesStoreState>);
          } catch (error) {
            // Fired from mount effects (`useProfiles`, `useEnsureProfiles`)
            // that cannot await it — see `reportError`. `initialized` stays
            // false, so the next mount retries.
            reportStoreError(ctx.callbacksManager, "profiles:init", error);
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
        // Never let a transport / response-shape failure escape as a
        // rejection: the caller's `await` sits between the form's
        // isSubmitting(true/false) calls, and an escaped throw leaves the
        // save button spinning forever — while the profile may already be
        // persisted server-side. Normalize every failure to TErrorData.
        let result: Awaited<ReturnType<typeof api.profiles.create>>;
        try {
          result = await api.profiles.create(data);
        } catch (e) {
          return {
            field: "name",
            message: e instanceof Error ? e.message : String(e),
          };
        }
        if (!result || result.success !== true) {
          return (
            result?.error ?? {
              field: "name",
              message: i18n.t("ProfileCreateFailed"),
            }
          );
        }
        if (!result.profile) {
          // Persisted server-side, but the host's route returned no
          // profile body — resync from storage so the list still shows it.
          await get().reloadProfiles();
          await get().reloadModelAssignment();
          return true;
        }
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
        // Same containment as addProfile — a rejection here would strand
        // the edit form's spinner.
        let result: Awaited<ReturnType<typeof api.profiles.update>>;
        try {
          result = await api.profiles.update(profile);
        } catch (e) {
          return {
            field: "name",
            message: e instanceof Error ? e.message : String(e),
          };
        }
        if (!result || result.success !== true) {
          return (
            result?.error ?? {
              field: "name",
              message: i18n.t("ProfileUpdateFailed"),
            }
          );
        }
        backfillCapabilities([profile]);
        const before = currentChat(get());
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
        const effective = currentChat(fresh);
        if (effective?.id === profile.id) {
          adoptModelDefault(before, effective);
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
        const before = currentChat(get());
        set({ chatProfile: profile });
        adoptModelDefault(before, currentChat(get()));
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
        const before = currentChat(get());
        set({ sessionChatProfile: profile });
        adoptModelDefault(before, currentChat(get()));
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
        await get().setReasoningLevel(
          get().extendedThinking ? "off" : lastDepth
        );
      },

      setReasoningLevel: async (level) => {
        await writeLevel(level);
        applyLevel(level);
      },

      reloadExtendedThinking: async () => {
        const next = await readLevel();
        if (get().reasoningLevel === next) return;
        applyLevel(next);
      },
    };
  });

  return store;
}
