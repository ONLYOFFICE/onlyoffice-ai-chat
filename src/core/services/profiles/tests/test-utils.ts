import { vi } from "vitest";
import type { Model } from "../../../../shared/model";
import type { Profile } from "../../../types";
import { AbstractBaseProvider } from "../../../providers";
import {
  registerProvider,
  unregisterProvider,
} from "../../../providers";
import type { StorageAdapter } from "../../../storage";

export const checkProviderMock = vi.fn();
export const getProviderModelsMock = vi.fn();
export const checkResponsesApiMock = vi.fn().mockResolvedValue(false);

export class StubProfileProvider extends AbstractBaseProvider {
  // eslint-disable-next-line require-yield
  async *sendMessage(): AsyncGenerator<never> {
    throw new Error("not used");
  }
  async sendMessageSync(): Promise<string> {
    return "";
  }
  async checkResponsesApi(
    modelId: string,
    signal?: AbortSignal
  ): Promise<boolean> {
    return checkResponsesApiMock(modelId, signal);
  }
  static getName(): string {
    return "Profile Stub";
  }
  static getBaseUrl(): string {
    return "https://stub";
  }
  static checkProvider = (...args: unknown[]) => checkProviderMock(...args);
  static getProviderModels = (...args: unknown[]) =>
    getProviderModelsMock(...args);
}

export const PROFILE_STUB_TYPE = "profile-stub";

export function registerStubProvider(): void {
  registerProvider(PROFILE_STUB_TYPE, StubProfileProvider);
}

export function unregisterStubProvider(): void {
  unregisterProvider(PROFILE_STUB_TYPE);
}

export function makeStorage(seed: { profiles?: Profile[] } = {}) {
  let profiles: Profile[] = [...(seed.profiles ?? [])];
  let assignments: Record<string, string> = {};

  const storage = {
    profiles: {
      create: vi.fn(
        async (
          input: Omit<Profile, "id" | "createdAt">
        ): Promise<Profile> => {
          const p: Profile = {
            ...input,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
          } as Profile;
          profiles.push(p);
          return p;
        }
      ),
      createMany: vi.fn(
        async (
          inputs: Omit<Profile, "id" | "createdAt">[]
        ): Promise<Profile[]> => {
          const created = inputs.map(
            (i) =>
              ({
                ...i,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
              }) as Profile
          );
          profiles = [...profiles, ...created];
          return created;
        }
      ),
      readById: vi.fn(async (id: string) => profiles.find((p) => p.id === id)),
      readAll: vi.fn(async () => [...profiles]),
      update: vi.fn(async (p: Profile) => {
        const i = profiles.findIndex((x) => x.id === p.id);
        if (i >= 0) profiles[i] = p;
      }),
      delete: vi.fn(async (id: string) => {
        profiles = profiles.filter((p) => p.id !== id);
      }),
    },
    assignments: {
      create: vi.fn(async (type: string, id: string) => {
        assignments[type] = id;
      }),
      readByType: vi.fn(async (type: string) => assignments[type] ?? null),
      readAll: vi.fn(async () => ({ ...assignments })),
      update: vi.fn(async (type: string, id: string) => {
        assignments[type] = id;
      }),
      upsertMany: vi.fn(async (m: Record<string, string>) => {
        assignments = { ...assignments, ...m };
      }),
      delete: vi.fn(async (type: string) => {
        delete assignments[type];
      }),
      deleteMany: vi.fn(async (types: string[]) => {
        for (const t of types) delete assignments[t];
      }),
    },
    threads: {} as never,
    messages: {} as never,
    prompts: {} as never,
    promptFolders: {} as never,
    preferences: {} as never,
    mcpServers: {} as never,
    toolPrefs: {} as never,
    webSearch: {} as never,
    init: vi.fn(),
    close: vi.fn(),
  } satisfies Partial<StorageAdapter> as unknown as StorageAdapter;

  return {
    storage,
    snapshot: () => ({
      profiles: [...profiles],
      assignments: { ...assignments },
    }),
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "p-existing",
    name: "Existing",
    providerType: PROFILE_STUB_TYPE,
    baseUrl: "https://stub",
    key: "k",
    modelId: "m",
    createdAt: 1,
    capabilities: 0xff,
    ...overrides,
  };
}

export function dummyModel(id = "m1"): Model {
  return { id, name: id, provider: PROFILE_STUB_TYPE };
}
