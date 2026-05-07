import { ActionType } from "../../../shared/action-type";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { Profile } from "../../types";
import { AssignmentsEngine } from "../assignments";
import { credsOf, loadProfile, providerFor } from "./lookup";
import { probeToolCapability } from "./probe-tools";
import type {
  CreateProfileInput,
  ProfileMutationResult,
  ProfilesEngineDeps,
} from "./types";
import { checkCredentials, validateProfile } from "./validation";

/**
 * Profile lifecycle orchestrator. Wraps `storage.profiles` with the
 * business rules that plain CRUD can't express:
 *
 * - Name uniqueness on `create` / `update`.
 * - Credential validation against the concrete provider class via
 *   {@link ProviderConstructor.checkProvider}.
 * - Auto-assign the default profile slot when the first profile is
 *   created.
 * - Cascading cleanup of `storage.assignments` rows that point to a
 *   profile being deleted.
 * - Storage+provider joins for `listModels` and `testConnection`.
 */
export class ProfilesEngine {
  private readonly deps: ProfilesEngineDeps;
  private readonly assignments: AssignmentsEngine;

  constructor(deps: ProfilesEngineDeps) {
    this.deps = deps;
    this.assignments =
      deps.assignments ?? new AssignmentsEngine({ storage: deps.storage });
  }

  async create(input: CreateProfileInput): Promise<ProfileMutationResult> {
    const { storage } = this.deps;
    const existing = await storage.profiles.readAll();

    const error = await validateProfile(existing, input);
    if (error) return { success: false, error };

    const canUseTool = await probeToolCapability(input);
    const profile = await storage.profiles.create({ ...input, canUseTool });

    // First profile ever — promote it to the default slot. Other
    // per-action assignments stay unset; the user opts into those
    // explicitly through the UI.
    if (existing.length === 0) {
      await storage.assignments.create(ActionType.Default, profile.id);
    }

    return { success: true, profile };
  }

  async update(profile: Profile): Promise<ProfileMutationResult> {
    const { storage } = this.deps;
    const existing = await storage.profiles.readAll();

    const prev = existing.find((p) => p.id === profile.id);
    if (!prev) {
      return {
        success: false,
        error: { field: "name", message: "Profile not found" },
      };
    }

    const error = await validateProfile(existing, profile, profile.id);
    if (error) return { success: false, error };

    const probeTriggers =
      prev.modelId !== profile.modelId ||
      prev.providerType !== profile.providerType ||
      prev.baseUrl !== profile.baseUrl;
    const canUseTool = probeTriggers
      ? await probeToolCapability(profile)
      : (profile.canUseTool ?? prev.canUseTool);

    const next: Profile = { ...profile, canUseTool };
    await storage.profiles.update(next);
    return { success: true, profile: next };
  }

  async delete(id: string): Promise<void> {
    await this.assignments.cascadeProfileDelete(id);
    await this.deps.storage.profiles.delete(id);
  }

  async listModels(profileId: string): Promise<Model[]> {
    const profile = await loadProfile(this.deps.storage, profileId);
    return providerFor(profile.providerType).getProviderModels(
      credsOf(profile)
    );
  }

  async testConnection(profileId: string): Promise<true | TErrorData> {
    const profile = await loadProfile(this.deps.storage, profileId);
    return checkCredentials(profile);
  }

  /** Retrieve a single profile by id, or `undefined` if it does not exist. */
  async getById(id: string): Promise<Profile | undefined> {
    return this.deps.storage.profiles.readById(id);
  }

  /** List all profiles — passthrough. */
  async list(): Promise<Profile[]> {
    return this.deps.storage.profiles.readAll();
  }
}
