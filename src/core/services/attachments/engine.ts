import type { Attachment } from "../../storage";
import type { AttachmentsEngineDeps } from "./types";

/**
 * Thin orchestrator over `storage.attachments`.
 *
 * Composer flow saves attachments here as drafts (no `messageId`/
 * `threadId` yet). Once the user message has been persisted by
 * {@link AIEngine.sendWithStream}, the UI calls
 * {@link linkToMessage} to bind the draft attachments to their
 * owning message — after which the cascade-on-message-delete keeps
 * the records in step.
 *
 * Storage owns id and `createdAt` generation; this engine never
 * synthesizes them.
 */
export class AttachmentsEngine {
  private readonly deps: AttachmentsEngineDeps;

  constructor(deps: AttachmentsEngineDeps) {
    this.deps = deps;
  }

  /**
   * Persist a file attachment as a draft. The `content` field carries
   * the host-extracted text — the same payload that used to live inline
   * in `ThreadMessageLike.content[].data`.
   *
   * Single-input convenience over {@link saveFilesMany}; prefer the
   * batch form when adding more than one file at once so it lands on
   * the backend as one round trip.
   */
  async saveFile(
    input: {
      path: string;
      content: string;
      type: number;
      title?: string;
    },
    entityId?: string
  ): Promise<Attachment> {
    const [record] = await this.saveFilesMany([input], entityId);
    return record;
  }

  /**
   * Persist a batch of file attachments as drafts in a single round
   * trip. Order of the returned records matches the input.
   */
  saveFilesMany(
    inputs: {
      path: string;
      content: string;
      type: number;
      title?: string;
    }[],
    entityId?: string
  ): Promise<Attachment[]> {
    if (inputs.length === 0) return Promise.resolve([]);
    return this.deps.storage.attachments.createMany(
      inputs.map((input) => ({
        kind: "file",
        title: input.title ?? deriveFileTitle(input.path),
        content: input.content,
        path: input.path,
        type: input.type,
        entityId,
      }))
    );
  }

  /**
   * Persist an image attachment as a draft. `base64` is a full data
   * URL (`data:image/...;base64,…`) — the same payload that used to
   * live inline in `ThreadMessageLike.content[].image`.
   *
   * Single-input convenience over {@link saveImagesMany}; prefer the
   * batch form when adding more than one image at once.
   */
  async saveImage(
    input: {
      name: string;
      base64: string;
      title?: string;
    },
    entityId?: string
  ): Promise<Attachment> {
    const [record] = await this.saveImagesMany([input], entityId);
    return record;
  }

  /**
   * Persist a batch of image attachments as drafts in a single round
   * trip. Order of the returned records matches the input.
   */
  saveImagesMany(
    inputs: {
      name: string;
      base64: string;
      title?: string;
    }[],
    entityId?: string
  ): Promise<Attachment[]> {
    if (inputs.length === 0) return Promise.resolve([]);
    return this.deps.storage.attachments.createMany(
      inputs.map((input) => ({
        kind: "image",
        title: input.title ?? input.name,
        base64: input.base64,
        entityId,
      }))
    );
  }

  /** Look up a single attachment by id. */
  get(id: string): Promise<Attachment | null> {
    return this.deps.storage.attachments.readById(id);
  }

  /** Batch fetch — preserves caller order, missing ids return `null`. */
  getMany(ids: string[]): Promise<(Attachment | null)[]> {
    return this.deps.storage.attachments.readManyByIds(ids);
  }

  /** Hard-delete a draft (or already-linked) attachment. */
  delete(id: string): Promise<void> {
    return this.deps.storage.attachments.delete(id);
  }

  /** Hard-delete a batch in one round trip. */
  deleteMany(ids: string[]): Promise<void> {
    return this.deps.storage.attachments.deleteMany(ids);
  }

  /**
   * Bind a batch of draft attachments to their owning message.
   * Called after the user message has been persisted so the
   * cascade-on-message-delete (in `messages.delete`) can find them.
   *
   * Uses `allSettled` so a single failed `update` doesn't abort the
   * rest of the batch — partial linking is preferable to leaving the
   * caller's list half-orphaned. Failures are silently swallowed; the
   * record remains a draft and will be picked up by future GC.
   */
  async linkToMessage(
    ids: string[],
    messageId: string,
    threadId: string
  ): Promise<void> {
    if (ids.length === 0) return;
    await Promise.allSettled(
      ids.map((id) =>
        this.deps.storage.attachments.update(id, { messageId, threadId })
      )
    );
  }
}

function deriveFileTitle(path: string): string {
  if (path.includes("\\")) return path.split("\\").pop() ?? path;
  return path.split("/").pop() ?? path;
}
