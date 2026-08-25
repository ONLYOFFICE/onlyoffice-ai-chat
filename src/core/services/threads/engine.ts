import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Profile, Thread } from "../../types";
import { resolveAttachmentRefs } from "../../actions/attachment-resolution";
import { generateTitle } from "../../actions/title";
import type { ActionArgs } from "../../actions/types";
import {
  drainPages,
  isPaginationEnabled,
  messagesCursorOf,
  type MessagesCursor,
  type ThreadsCursor,
} from "../../storage";
import type {
  OpenOrCreateInput,
  OpenOrCreateResult,
  ThreadsEngineDeps,
} from "./types";

/**
 * Thread lifecycle orchestrator. Wraps `storage.threads` +
 * `storage.messages` with the rules that plain CRUD can't express:
 *
 * - **Auto-generated titles** for new threads via the
 *   {@link generateTitle} action, with a `"New chat"` fallback.
 * - **Coupled writes** — appending a user message also bumps the
 *   thread's `lastEditDate` so the sidebar resurfaces it.
 * - **Coordinated rename** — sets the title and bumps `lastEditDate`
 *   together so the rename is visible in the sidebar.
 * - **Title regeneration** — re-runs `generateTitle` against the
 *   thread's first user message and persists the result.
 *
 * The engine never touches assignments — callers (typically
 * {@link AIEngine}) resolve a profile through {@link AssignmentsEngine}
 * and pass it in.
 */
export class ThreadsEngine {
  private readonly deps: ThreadsEngineDeps;

  constructor(deps: ThreadsEngineDeps) {
    this.deps = deps;
  }

  /**
   * Read a thread's complete history. With {@link ThreadsEngineDeps.pagination}
   * enabled the read walks the thread in cursor pages (bounded requests,
   * same complete result); otherwise it is the single unbounded call —
   * the pre-pagination behavior.
   */
  private readAllMessages(threadId: string): Promise<ThreadMessageLike[]> {
    if (!isPaginationEnabled(this.deps.pagination)) {
      return this.deps.storage.messages.readByThread(threadId);
    }
    return drainPages(
      (count, cursor) =>
        this.deps.storage.messages.readByThread(threadId, count, cursor),
      messagesCursorOf,
      (m) => m.id ?? ""
    );
  }

  /**
   * Create a new thread with a caller-supplied title. Returns the
   * persisted {@link Thread} as assigned by storage (id + lastEditDate
   * are populated). Use {@link openOrCreate} when the title should be
   * auto-generated from the first user message.
   */
  async create(input: {
    title: string;
    profileId?: string;
    entityId?: string;
  }): Promise<Thread> {
    const thread = await this.deps.storage.threads.create(
      input.title,
      input.profileId,
      input.entityId
    );
    return thread;
  }

  /**
   * Open an existing thread (returning its prior history) or create a
   * new one with an auto-generated title derived from `firstMessage`.
   * Used by `AIEngine.sendWithStream` to bootstrap a streaming chat.
   *
   * Does **not** persist `firstMessage` — the caller decides whether
   * to follow up with {@link appendUserMessage}, since some flows
   * just want to inspect history.
   */
  async openOrCreate(input: OpenOrCreateInput): Promise<OpenOrCreateResult> {
    if (input.threadId) {
      const priorMessages = await this.readAllMessages(input.threadId);
      return { threadId: input.threadId, title: "", priorMessages };
    }

    // Hydrate image/file refs before the provider call — `firstMessage`
    // arrives in its persisted form, where attachments are lightweight
    // ref markers rather than inline base64.
    const generated = await generateTitle({
      ...input.entityMeta,
      profile: input.profile,
      messages: await resolveAttachmentRefs(
        [input.firstMessage],
        this.deps.storage.attachments
      ),
    });
    const title = generated || "New chat";
    const thread = await this.deps.storage.threads.create(
      title,
      input.profileId,
      input.entityId
    );
    return { threadId: thread.threadId, title, priorMessages: [] };
  }

  /**
   * Persist a user message in `threadId` and bump the thread's
   * `lastEditDate` to `Date.now()`. Optionally rebinds the thread to
   * `profileId` when the active profile has changed mid-conversation.
   * Returns the persisted message (with storage-assigned `id` and
   * `createdAt`).
   */
  async appendUserMessage(
    threadId: string,
    message: Omit<ThreadMessageLike, "id" | "createdAt">,
    profileId?: string
  ): Promise<ThreadMessageLike> {
    const [stored] = await Promise.all([
      this.deps.storage.messages.create(threadId, message),
      this.deps.storage.threads.touch(threadId, Date.now(), { profileId }),
    ]);
    if (!stored.id) {
      throw new Error(`storage.messages.create returned no id for ${threadId}`);
    }
    return stored;
  }

  /**
   * Bump the thread's `lastEditDate` to `Date.now()` and optionally
   * rebind it to `profileId`. Used when an event other than a new
   * message (e.g. a profile switch from the composer) should resurface
   * the thread in the sidebar.
   */
  async touch(threadId: string, profileId?: string): Promise<void> {
    await this.deps.storage.threads.touch(threadId, Date.now(), { profileId });
  }

  /**
   * Rename a thread and bump `lastEditDate` so the rename is visible
   * in the sidebar. Two writes by necessity — `update` doesn't bump
   * the timestamp, `touch` doesn't take a title.
   */
  async rename(threadId: string, title: string): Promise<void> {
    await this.deps.storage.threads.update(threadId, title);
    await this.deps.storage.threads.touch(threadId, Date.now());
  }

  /**
   * Delete a thread. Storage cascades to its messages — see
   * {@link ThreadsStorage.delete}.
   */
  async delete(threadId: string): Promise<void> {
    await this.deps.storage.threads.delete(threadId);
  }

  /**
   * Drop every message in the thread without deleting the thread
   * itself. Bumps `lastEditDate` so the sidebar reflects the change.
   */
  async clearMessages(threadId: string): Promise<void> {
    await this.deps.storage.messages.deleteByThread(threadId);
    await this.deps.storage.threads.touch(threadId, Date.now());
  }

  /**
   * Re-run {@link generateTitle} against the thread's first user
   * message and persist the result. Returns the new title. Throws if
   * the thread has no user messages yet.
   *
   * `entityMeta` is the host entity pair the round runs for; it reaches
   * the provider as the request's `metadata`, matching what a chat round
   * sends. Omit it and the title request carries no entity description.
   */
  async regenerateTitle(
    threadId: string,
    profile: Profile,
    entityMeta?: Pick<ActionArgs, "entityId" | "entityTitle">
  ): Promise<string> {
    const messages = await this.deps.storage.messages.readByThread(threadId, 1);
    const first = messages[0];
    if (!first) {
      throw new Error(
        `Thread has no messages to derive a title from: ${threadId}`
      );
    }
    // Stored messages carry attachments as ref markers — hydrate them
    // into inline base64 before the provider call.
    const generated = await generateTitle({
      ...entityMeta,
      profile,
      messages: await resolveAttachmentRefs(
        [first],
        this.deps.storage.attachments
      ),
    });
    const title = generated || "New chat";
    await this.deps.storage.threads.update(threadId, title);
    await this.deps.storage.threads.touch(threadId, Date.now());
    return title;
  }

  /**
   * List threads in scope, sorted by `lastEditDate` desc — passthrough.
   * `entityId` is opaque to the engine and forwarded to storage; see
   * {@link ThreadsStorage.readAll} for the scoping, cursor-pagination
   * and title-search semantics. Omit `count`/`cursor` for the full
   * list; pass `query` for a server-side case-insensitive title search.
   */
  async list(
    entityId?: string,
    count?: number,
    cursor?: ThreadsCursor,
    query?: string
  ): Promise<Thread[]> {
    return this.deps.storage.threads.readAll(entityId, count, cursor, query);
  }

  /** Read messages from a thread — passthrough with same pagination. */
  async readMessages(
    threadId: string,
    count?: number,
    cursor?: MessagesCursor
  ): Promise<ThreadMessageLike[]> {
    return this.deps.storage.messages.readByThread(threadId, count, cursor);
  }

  /** Retrieve a single thread by id, or `null` if it does not exist. */
  async getById(threadId: string): Promise<Thread | null> {
    return this.deps.storage.threads.readById(threadId);
  }

  /** Retrieve a single message by its globally-unique id. */
  async getMessageById(messageId: string): Promise<ThreadMessageLike | null> {
    return this.deps.storage.messages.readById(messageId);
  }

  /**
   * Replace the content of an existing message. Used by edit/regenerate
   * flows that mutate a message outside the streaming lifecycle.
   */
  async updateMessage(
    messageId: string,
    message: Omit<ThreadMessageLike, "id" | "createdAt">
  ): Promise<void> {
    await this.deps.storage.messages.update(messageId, message);
  }

  /** Delete a single message without touching the rest of the thread. */
  async deleteMessage(messageId: string): Promise<void> {
    await this.deps.storage.messages.delete(messageId);
  }
}
