import type {
  StorageAdapter,
  ThreadsStorage,
  MessagesStorage,
  ProfilesStorage,
  PromptsStorage,
  PromptFoldersStorage,
} from "@onlyoffice/ai-chat";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  Thread,
  Profile,
  Prompt,
  PromptFolder,
  TProvider,
  Model,
} from "@onlyoffice/ai-chat";

const API = "/api/storage";

async function api(
  method: string,
  entity: string,
  params: Record<string, string> = {},
  body?: unknown
) {
  const qs = new URLSearchParams({ entity, ...params }).toString();
  const res = await fetch(`${API}?${qs}`, {
    method,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  return res.json();
}

// ---------------------------------------------------------------------------

const threads: ThreadsStorage = {
  async create(threadId, title, provider?: TProvider, model?: Model, profileId?: string) {
    await api("POST", "threads", {}, { threadId, title, provider, model, profileId });
  },
  async getAll(): Promise<Thread[]> {
    return api("GET", "threads");
  },
  async getById(threadId): Promise<Thread | null> {
    return api("GET", "threads", { id: threadId });
  },
  async update(threadId, title?) {
    await api("PATCH", "threads", { id: threadId }, { title });
  },
  async touch(threadId, updates?) {
    await api("PATCH", "threads", { id: threadId }, updates ?? {});
  },
  async delete(threadId) {
    await api("DELETE", "threads", { id: threadId });
  },
};

const messages: MessagesStorage = {
  async create(threadId, id, message) {
    await api("POST", "messages", {}, { threadId, id, message });
  },
  async getByThread(threadId, limit?): Promise<ThreadMessageLike[]> {
    const params: Record<string, string> = { threadId };
    if (limit) params.limit = String(limit);
    const result = await api("GET", "messages", params);
    return (result as ThreadMessageLike[]).filter(
      (m: ThreadMessageLike) => m && "role" in m && m.role
    );
  },
  async getById(threadId, messageId): Promise<ThreadMessageLike | null> {
    return api("GET", "messages", { threadId, id: messageId });
  },
  async update(messageId, message) {
    await api("PATCH", "messages", { id: messageId }, { message });
  },
  async delete(messageId) {
    await api("DELETE", "messages", { id: messageId });
  },
  async deleteByThread(threadId) {
    await api("DELETE", "messages", { threadId });
  },
  async replaceByThread(threadId, msgs) {
    await api("PUT", "messages", { threadId }, { messages: msgs });
  },
  async search(query) {
    return api("GET", "messages", { search: query });
  },
};

const profiles: ProfilesStorage = {
  async create(profile: Profile) {
    await api("POST", "profiles", {}, profile);
  },
  async createMany(profs: Profile[]) {
    await api("POST", "profiles", {}, profs);
  },
  async getAll(): Promise<Profile[]> {
    return api("GET", "profiles");
  },
  async getById(id): Promise<Profile | undefined> {
    const result = await api("GET", "profiles", { id });
    return result ?? undefined;
  },
  async update(profile: Profile) {
    await api("PATCH", "profiles", {}, profile);
  },
  async delete(id) {
    await api("DELETE", "profiles", { id });
  },
};

const prompts: PromptsStorage = {
  async create(prompt: Prompt) {
    await api("POST", "prompts", {}, prompt);
  },
  async getAll(): Promise<Prompt[]> {
    return api("GET", "prompts");
  },
  async getById(id): Promise<Prompt | null> {
    return api("GET", "prompts", { id });
  },
  async update(id, updates) {
    await api("PATCH", "prompts", { id }, updates);
  },
  async delete(id) {
    await api("DELETE", "prompts", { id });
  },
  async deleteByFolder(folderId) {
    await api("DELETE", "prompts", { folderId });
  },
};

const promptFolders: PromptFoldersStorage = {
  async create(folder: PromptFolder) {
    await api("POST", "folders", {}, folder);
  },
  async getAll(): Promise<PromptFolder[]> {
    return api("GET", "folders");
  },
  async getById(id): Promise<PromptFolder | null> {
    return api("GET", "folders", { id });
  },
  async update(id, name) {
    await api("PATCH", "folders", { id }, { name });
  },
  async delete(id) {
    await api("DELETE", "folders", { id });
  },
};

// ---------------------------------------------------------------------------

export const storage: StorageAdapter = {
  threads,
  messages,
  profiles,
  prompts,
  promptFolders,
  async init() {},
  async close() {},
};
