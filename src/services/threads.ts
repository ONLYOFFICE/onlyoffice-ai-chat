import type { AppContext } from "../app-context";
import type { Profile, Thread } from "../types";
import { convertMessagesToMd, removeSpecialCharacter } from "../utils";

/**
 * Manages chat thread lifecycle -- creation, loading, renaming, deletion,
 * history clearing, and exporting threads as downloadable documents.
 *
 * Also handles migration of legacy threads (with inline provider/model data)
 * to the profile-based model.
 */
export class ThreadsService {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }
  /**
   * Load all threads from storage.
   *
   * @returns An array of all persisted {@link Thread} objects.
   */
  async loadAll(): Promise<Thread[]> {
    const storage = this.ctx.storage;
    return storage.threads.getAll();
  }

  /**
   * Create a new thread and persist it to storage.
   *
   * @param threadId - Unique identifier for the new thread.
   * @param title - Display title for the thread.
   * @param profileId - Optional profile to associate with the thread.
   * @returns The newly created {@link Thread} object.
   */
  createThread(threadId: string, title: string, profileId?: string): Thread {
    const thread: Thread = {
      threadId,
      title,
      profileId,
      lastEditDate: Date.now(),
    };
    const storage = this.ctx.storage;
    storage.threads.create(threadId, title, undefined, undefined, profileId);
    return thread;
  }

  touchThread(threadId: string, updates?: { profileId?: string }): void {
    const storage = this.ctx.storage;
    storage.threads.touch(threadId, {
      ...(updates && "profileId" in updates
        ? { profileId: updates.profileId }
        : {}),
    });
  }

  migrateThreadToProfile(
    thread: Thread,
    profiles: Profile[],
    chatProfile: Profile | null,
    defaultProfile: Profile | null
  ): Thread {
    const { provider, model, ...rest } = thread;

    const matched =
      profiles.find(
        (p) =>
          p.providerType === provider?.type &&
          p.baseUrl === provider?.baseUrl &&
          p.modelId === model?.id &&
          p.key === provider?.key
      ) ??
      profiles.find(
        (p) =>
          p.providerType === provider?.type &&
          p.baseUrl === provider?.baseUrl &&
          p.modelId === model?.id
      ) ??
      chatProfile ??
      defaultProfile;

    const migratedThread: Thread = { ...rest, profileId: matched?.id };

    const storage = this.ctx.storage;
    storage.threads.touch(thread.threadId, {
      profileId: matched?.id ?? null,
      provider: null,
      model: null,
    });

    return migratedThread;
  }

  /**
   * Export a thread's messages as a `.docx` file via the platform file adapter.
   *
   * @param threadId - The thread to export.
   * @param threadTitle - Optional title used as the file name (sanitized).
   *   Defaults to "Chat Export" when omitted.
   */
  async downloadThread(threadId: string, threadTitle?: string): Promise<void> {
    const storage = this.ctx.storage;
    const messages = await storage.messages.getByThread(threadId);
    const title = removeSpecialCharacter(threadTitle || "Chat Export");
    const content = convertMessagesToMd(messages);
    this.ctx.platform.file?.saveAsFile(content, `${title}.docx`);
  }

  /**
   * Update the display title of an existing thread.
   *
   * @param id - The thread identifier.
   * @param title - The new title.
   */
  renameThread(id: string, title: string): void {
    const storage = this.ctx.storage;
    storage.threads.update(id, title);
  }

  /**
   * Permanently delete a thread and all of its associated messages from storage.
   *
   * @param id - The thread identifier to delete.
   */
  async deleteThread(id: string): Promise<void> {
    const storage = this.ctx.storage;
    await storage.messages.deleteByThread(id);
    await storage.threads.delete(id);
  }

  /**
   * Delete all messages within a thread while keeping the thread itself.
   *
   * @param id - The thread identifier whose messages should be cleared.
   */
  async clearHistory(id: string): Promise<void> {
    const storage = this.ctx.storage;
    await storage.messages.deleteByThread(id);
  }
}
