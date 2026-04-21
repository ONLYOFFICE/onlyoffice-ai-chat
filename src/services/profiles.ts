import type { AppContext } from "../app-context";
import type { TErrorData } from "../providers/base";
import type { Profile } from "../types";

const NAME_EXISTS_ERROR = {
  field: "name" as const,
  message: "Duplicate name",
};

/**
 * Keys used to persist the default and per-task profile selections in settings.
 *
 * @property defaultKey - Settings key for the default (chat) profile ID.
 * @property taskKeys - Settings keys for action-specific profile IDs
 *   (e.g. summarization, translation).
 */
export type TaskProfileKeys = {
  defaultKey: string;
  taskKeys: string[];
};

/**
 * Result returned by {@link ProfilesService.init} after loading all profiles
 * from storage and resolving the default and task-specific selections.
 *
 * @property profiles - All stored profiles in display order.
 * @property defaultProfile - The currently selected default profile, or `null`.
 * @property taskProfiles - Map of task settings key to resolved profile (or `null`).
 */
export type ProfilesInitResult = {
  profiles: Profile[];
  defaultProfile: Profile | null;
  taskProfiles: Record<string, Profile | null>;
};

/**
 * Manages AI provider profiles -- CRUD operations, validation against the
 * provider registry, and resolution of the default / task-specific profile
 * selections persisted in settings.
 *
 * All storage and settings access goes through the injected {@link AppContext}.
 */
export class ProfilesService {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  loadProfileById(profiles: Profile[], key: string): Profile | null {
    const settings = this.ctx.settings;
    const id = settings.get(key);
    if (!id) return null;
    const found = profiles.find((p) => p.id === id);
    if (!found) {
      settings.remove(key);
      return null;
    }
    return found;
  }

  applyCurrentChatProvider(
    sessionChatProfile: Profile | null,
    chatProfile: Profile | null,
    defaultProfile: Profile | null
  ): void {
    const active = sessionChatProfile ?? chatProfile ?? defaultProfile;
    if (active) {
      this.ctx.provider.setCurrentProvider({
        type: active.providerType,
        name: active.name,
        baseUrl: active.baseUrl,
        key: active.key,
      });
      this.ctx.provider.setCurrentProviderModel(
        active.modelId,
        active.reasoning
      );
    } else {
      this.ctx.provider.setCurrentProvider(undefined);
    }
  }

  /**
   * Load all profiles from storage and resolve the default and per-task
   * profile selections from settings.
   *
   * If no default profile is persisted, the first available profile is used.
   *
   * @param keys - Settings keys for the default and task-specific profiles.
   * @returns The full list of profiles along with resolved default and task selections.
   */
  async init(keys: TaskProfileKeys): Promise<ProfilesInitResult> {
    const storage = this.ctx.storage;
    const settings = this.ctx.settings;
    // Sort newest-first by creation time. Legacy profiles without
    // `createdAt` fall back to 0 and land at the bottom of the list.
    const profiles = (await storage.profiles.getAll()).sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    );

    const defaultProfile =
      this.loadProfileById(profiles, keys.defaultKey) ?? profiles[0] ?? null;

    if (defaultProfile) {
      settings.set(keys.defaultKey, defaultProfile.id);
    }

    const taskProfiles: Record<string, Profile | null> = {};
    for (const key of keys.taskKeys) {
      taskProfiles[key] = this.loadProfileById(profiles, key);
    }

    return { profiles, defaultProfile, taskProfiles };
  }

  /**
   * Create a new profile after validating name uniqueness and provider
   * connectivity.
   *
   * @param data - Profile data (without `id`).
   * @param existingProfiles - Current profiles used for duplicate-name check.
   * @returns On success, the newly created {@link Profile}. On failure, an
   *   error describing which field failed validation.
   */
  async addProfile(
    data: Omit<Profile, "id">,
    existingProfiles: Profile[]
  ): Promise<
    { success: true; profile: Profile } | { success: false; error: TErrorData }
  > {
    const nameExists = existingProfiles.some(
      (p) => p.name.toLowerCase() === data.name.toLowerCase()
    );
    if (nameExists) {
      return { success: false, error: NAME_EXISTS_ERROR };
    }

    const checkResult = await this.ctx.provider.checkNewProvider(
      data.providerType,
      { url: data.baseUrl, apiKey: data.key }
    );

    if (checkResult === true) {
      const storage = this.ctx.storage;
      const newProfile: Profile = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      await storage.profiles.create(newProfile);
      return { success: true, profile: newProfile };
    }

    if (checkResult && typeof checkResult === "object") {
      return { success: false, error: checkResult };
    }

    return {
      success: false,
      error: { field: "key", message: "Provider validation failed" },
    };
  }

  /**
   * Update an existing profile after re-validating name uniqueness and
   * provider connectivity.
   *
   * @param profile - The full profile object with updated fields.
   * @param existingProfiles - Current profiles used for duplicate-name check.
   * @returns Success indicator, or an error describing the failing field.
   */
  async editProfile(
    profile: Profile,
    existingProfiles: Profile[]
  ): Promise<{ success: true } | { success: false; error: TErrorData }> {
    const nameExists = existingProfiles.some(
      (p) =>
        p.name.toLowerCase() === profile.name.toLowerCase() &&
        p.id !== profile.id
    );
    if (nameExists) {
      return { success: false, error: NAME_EXISTS_ERROR };
    }

    const checkResult = await this.ctx.provider.checkNewProvider(
      profile.providerType,
      { url: profile.baseUrl, apiKey: profile.key }
    );

    if (checkResult === true) {
      const storage = this.ctx.storage;
      await storage.profiles.update(profile);
      return { success: true };
    }

    if (checkResult && typeof checkResult === "object") {
      return { success: false, error: checkResult };
    }

    return {
      success: false,
      error: { field: "key", message: "Provider validation failed" },
    };
  }

  /**
   * Permanently remove a profile from storage.
   *
   * @param id - The profile identifier to delete.
   */
  async deleteProfile(id: string): Promise<void> {
    const storage = this.ctx.storage;
    await storage.profiles.delete(id);
  }

  clearTaskProfileIfMatch(
    profile: Profile | null,
    id: string,
    key: string
  ): Profile | null {
    if (profile?.id === id) {
      this.ctx.settings.remove(key);
      return null;
    }
    return profile;
  }

  reassignDefault(
    profiles: Profile[],
    deletedId: string,
    currentDefault: Profile | null,
    defaultKey: string
  ): Profile | null {
    const settings = this.ctx.settings;
    if (currentDefault?.id !== deletedId) return currentDefault;

    const nextDefault = profiles[0] ?? null;
    if (nextDefault) {
      settings.set(defaultKey, nextDefault.id);
    } else {
      settings.remove(defaultKey);
    }
    return nextDefault;
  }

  /**
   * Persist (or clear) the profile selection for a specific task action.
   *
   * @param key - The settings key that identifies the task action.
   * @param profile - The profile to assign, or `null` to clear the selection.
   */
  setTaskProfile(key: string, profile: Profile | null): void {
    const settings = this.ctx.settings;
    if (profile) {
      settings.set(key, profile.id);
    } else {
      settings.remove(key);
    }
  }

  /**
   * Resolve the effective chat profile using a priority chain:
   * session override > persisted chat profile > default profile.
   *
   * @param sessionChatProfile - Temporary session-level override (highest priority).
   * @param chatProfile - Persisted chat profile selection.
   * @param defaultProfile - Global default profile (lowest priority).
   * @returns The first non-null profile in the chain, or `null` if none exist.
   */
  selectCurrentChatProfile(
    sessionChatProfile: Profile | null,
    chatProfile: Profile | null,
    defaultProfile: Profile | null
  ): Profile | null {
    return sessionChatProfile ?? chatProfile ?? defaultProfile;
  }
}
