import { ActionType } from "../../../shared/action-type";
import type { TErrorData } from "../../../shared/error-data";
import type { Model } from "../../../shared/model";
import type { ProviderFetch } from "../../../shared/provider-credentials";
import type { Profile, ProviderType } from "../../types";
import { AssignmentsEngine } from "../assignments";
import { credsOf, loadProfile, providerFor } from "./lookup";
import { probeCapabilities } from "./probe-capabilities";
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

  // Mirrors AIEngine.pickFetch so the probe travels the same transport as
  // chat; an `external` profile without externalFetch simply probes bare
  // and fails soft instead of throwing out of `create`.
  private pickFetch(
    profile: Pick<Profile, "providerType" | "useProxy">
  ): ProviderFetch | undefined {
    if (profile.providerType === "external") return this.deps.externalFetch;
    const forced =
      typeof this.deps.forceProxy === "function"
        ? this.deps.forceProxy()
        : this.deps.forceProxy === true;
    return profile.useProxy || forced ? this.deps.fetchProxy : undefined;
  }

  async create(input: CreateProfileInput): Promise<ProfileMutationResult> {
    const { storage } = this.deps;
    const existing = await storage.profiles.readAll();

    const error = await validateProfile(existing, input);
    if (error) return { success: false, error };

    const { canUseTool, useResponsesApi } = await probeCapabilities(
      input,
      credsOf(input, this.pickFetch(input))
    );
    const profile = await storage.profiles.create({
      ...input,
      canUseTool,
      useResponsesApi,
    });

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
    const { canUseTool, useResponsesApi } = probeTriggers
      ? await probeCapabilities(
          profile,
          credsOf(profile, this.pickFetch(profile))
        )
      : {
          canUseTool: profile.canUseTool ?? prev.canUseTool,
          useResponsesApi: profile.useResponsesApi ?? prev.useResponsesApi,
        };

    const next: Profile = { ...profile, canUseTool, useResponsesApi };
    await storage.profiles.update(next);
    return { success: true, profile: next };
  }

  async delete(id: string): Promise<void> {
    await this.assignments.cascadeProfileDelete(id);
    await this.deps.storage.profiles.delete(id);
  }

  async listModels(profileId: string): Promise<Model[]> {
    const profile = await loadProfile(this.deps.storage, profileId);
    const Provider = await providerFor(profile.providerType);
    return Provider.getProviderModels(credsOf(profile));
  }

  async listProviderModels(input: {
    providerType: ProviderType;
    baseUrl: string;
    apiKey: string;
  }): Promise<Model[]> {
    // Always fetched live. This used to be cached by creds, but the engine
    // may run on a server shared across users and tenants, and forwarded-
    // header providers (the ONLYOFFICE gateway) make the key collide across
    // tenants — one tenant's list could answer another's lookup.
    const Provider = await providerFor(input.providerType);
    return Provider.getProviderModels({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
    });
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
