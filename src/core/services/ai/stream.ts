import type { ThreadMessageLike } from "@assistant-ui/react";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { ReasoningLevel } from "../../../shared/reasoning-level";
import type { ToolPermissionMode } from "../../../shared/tool-permission-mode";
import type { ActionArgs } from "../../actions/types";
import type { StorageAdapter } from "../../storage";
import logger from "../../../shared/logger";
import type { Profile } from "../../types";
import { allowAlwaysToken } from "../tools/allow-always";
import { readToolPermissionMode, resolveAutoAllow } from "../tools/auto-allow";
import { readToolCall } from "./tool-call";
import type { ChatEvent } from "./types";

/**
 * Whether a stored message carries content worth sending to the provider.
 *
 * Persisted terminal turns can be empty shells: an error or cancellation
 * that arrived before any delta is saved as `content: ""` plus a status,
 * so the UI can render "Error" / "Stopped" after a reload. Such a turn
 * must be kept out of the *request* history — most providers reject an
 * empty assistant turn (e.g. Anthropic 400). Callers filter prior
 * messages through this helper before handing them to the provider.
 */
export function hasSendableContent(message: ThreadMessageLike): boolean {
  const content = message.content;
  if (typeof content === "string") return content.trim().length > 0;
  return Array.isArray(content) && content.length > 0;
}

/**
 * Drop assistant tool-call parts that never got a result — a turn the
 * user stopped while the tool was executing leaves a `tool-call` with no
 * `result` persisted in storage. Sending it as request history produces
 * an unpaired `function_call` (no `function_call_output`), which OpenAI's
 * Responses API rejects with "No tool output found for function call".
 *
 * Stripping the dangling part keeps any sibling text; an assistant
 * message left with no content is then removed by {@link hasSendableContent}.
 * Resolved tool calls (including a cancelled `{ cancelled: true }` result)
 * are untouched, so legit multi-tool history is preserved. Applied to
 * request history only — never to what's persisted/displayed.
 */
export function stripUnresolvedToolCalls(
  messages: ThreadMessageLike[]
): ThreadMessageLike[] {
  return messages.map((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
    const content = m.content.filter(
      (c) =>
        !(
          c &&
          typeof c === "object" &&
          (c as { type?: string }).type === "tool-call" &&
          (c as { result?: unknown }).result === undefined
        )
    );
    return content.length === m.content.length ? m : { ...m, content };
  });
}

/**
 * Find the first incomplete tool-call (no `result`) in an assistant
 * message's content, or `-1` if none exists. Mirrors the legacy
 * `ChatEngine` behaviour — the model can request several tool calls
 * but the engine resolves them one at a time.
 */
function findPendingToolCall(message: ThreadMessageLike): number {
  if (!Array.isArray(message.content)) return -1;
  return message.content.findIndex(
    (c) =>
      c &&
      typeof c === "object" &&
      (c as { type?: string }).type === "tool-call" &&
      !(c as { result?: unknown }).result
  );
}

/**
 * Context passed to {@link processStream}. The engine resolves the
 * thread coordinates and supplies an optional {@link ToolDispatcher};
 * everything else (middleware, user callbacks, UI side-effects) is
 * applied by the consumer of the resulting `AsyncGenerator<ChatEvent>`.
 *
 * `isResume` distinguishes the first stream after a user message
 * (creates a new assistant message in storage) from a stream resumed
 * after a tool result (updates the existing assistant message in
 * place — that's the message that previously held the tool call).
 */
export type ProcessStreamContext = {
  storage: StorageAdapter;
  threadId: string;
  profile?: Profile;
  profileId?: string;
  tools?: ActionArgs["tools"];
  isReasoning?: boolean;
  reasoningLevel?: ReasoningLevel;
  signal?: AbortSignal;
  isResume?: boolean;
  /**
   * Opaque scope token forwarded to scoped storage reads (e.g.
   * `toolPrefs.readAllowAlways`, `preferences.readToolPermissionMode`).
   * Engine never inspects it.
   */
  entityId?: string;
  /**
   * The permission mode assumed while none is persisted in scope — the
   * host's `PreferenceDefaults.toolPermissionMode` where it overrides one.
   * Defaults to `"ask"`.
   */
  defaultToolPermissionMode?: ToolPermissionMode;
  /**
   * How often the in-flight assistant message is flushed to storage while
   * streaming, in milliseconds. The UI still receives every delta; storage
   * sees at most one write per interval plus the authoritative terminal
   * write, and a write never overlaps the previous one. The window of text
   * lost if the process dies mid-stream equals this interval, so the
   * default ({@link DEFAULT_PERSIST_INTERVAL_MS}) suits a local adapter;
   * a host whose adapter is a remote HTTP hop raises it (a few seconds).
   * Values below {@link MIN_PERSIST_INTERVAL_MS} are clamped; a
   * non-finite or non-positive value falls back to the default.
   */
  persistIntervalMs?: number;
  /** Existing assistant messageId to update when `isResume` is true. */
  resumeMessageId?: string;
  /**
   * Existing assistant message content (e.g. the tool-call + result that
   * triggered the resume). When set, every delta from the new round
   * is *merged* into this content rather than replacing it, so the same
   * assistant bubble keeps its tool-call and gains the follow-up text.
   */
  resumeBaseMessage?: ThreadMessageLike;
};

/**
 * Merge the freshly-streamed assistant snapshot into the resume base
 * message. Preserves the base content (typically the tool-call + result
 * the model is responding to) and appends the new content from `fresh`.
 */
function mergeResume(
  base: ThreadMessageLike,
  fresh: ThreadMessageLike
): ThreadMessageLike {
  const baseContent = Array.isArray(base.content) ? base.content : [];
  const freshContent = Array.isArray(fresh.content) ? fresh.content : [];
  return {
    ...fresh,
    role: fresh.role ?? base.role,
    content: [...baseContent, ...freshContent],
  } as ThreadMessageLike;
}

/** Default {@link ProcessStreamContext.persistIntervalMs}. */
export const DEFAULT_PERSIST_INTERVAL_MS = 150;

/** Lower bound for {@link ProcessStreamContext.persistIntervalMs}. */
export const MIN_PERSIST_INTERVAL_MS = 50;

/**
 * Resolve the configured persist interval: clamp to the lower bound so a
 * tiny value cannot turn the timer into a write-per-macrotask loop, and
 * fall back to the default for anything that is not a positive number.
 */
export function resolvePersistInterval(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_PERSIST_INTERVAL_MS;
  }
  return Math.max(value, MIN_PERSIST_INTERVAL_MS);
}

/**
 * Drive a `SendMessageResult` stream end-to-end:
 *
 * - On the first delta, persist the assistant message
 *   (`storage.messages.create`) and emit `message-start`. Subsequent
 *   deltas patch storage + emit `message-delta`.
 * - On terminal `isEnd` events:
 *   - `incomplete` → emit `message-incomplete` and stop.
 *   - assistant message contains an unresolved tool-call → forward to
 *     {@link handleToolCall}, which decides between auto-resolve
 *     (continues with `tool-call-executed`) and surfacing
 *     `tool-call-pending` to the caller.
 *   - otherwise → emit `message-end`.
 *
 * When `isResume` is true the first delta updates `resumeMessageId`
 * instead of creating a new message — used by the post-tool-call
 * resume path.
 *
 * No middleware or user callbacks are invoked; the consumer is free
 * to wrap this stream and apply them.
 */
export async function* processStream(
  stream: AsyncGenerator<SendMessageResult>,
  ctx: ProcessStreamContext
): AsyncGenerator<ChatEvent> {
  const { storage, threadId } = ctx;
  let messageId = ctx.resumeMessageId ?? "";
  let inited = !!ctx.isResume;
  // Last streamed snapshot — the accumulated assistant content the user
  // has already seen. Reused when a terminal `incomplete` event arrives so
  // a mid-stream error / cancellation keeps its partial text instead of
  // being overwritten by the provider's empty error/stop shell.
  let lastSnapshot: ThreadMessageLike | undefined = ctx.resumeBaseMessage;
  const base = ctx.resumeBaseMessage;
  const merge = (m: ThreadMessageLike) => (base ? mergeResume(base, m) : m);
  // Stamp the storage-assigned id onto the in-flight message so the UI
  // runtime tracks it by a stable id across deltas instead of falling
  // back to an array-index id (which churns on every append).
  const withId = (m: ThreadMessageLike): ThreadMessageLike =>
    messageId ? { ...m, id: messageId } : m;

  // Coalesce per-delta persistence. The UI still receives every
  // `message-delta` event (streaming is unaffected), but storage is written
  // on a timer — at most once per `persistIntervalMs` — instead of a full
  // whole-message rewrite on every token, which is costly against a remote /
  // host storage adapter and back-pressures the stream loop. The delta loop
  // never awaits a write: it only refreshes `lastSnapshot` and marks it
  // dirty. The first `create` still happens immediately (it yields the
  // `messageId`), and every terminal branch writes the authoritative final
  // message after `settle()` so it can neither race a periodic write nor be
  // overwritten by a stale snapshot.
  const intervalMs = resolvePersistInterval(ctx.persistIntervalMs);
  let dirty = false;
  let inflight: Promise<void> | null = null;

  // Write the latest snapshot if it changed since the previous write. A tick
  // that lands while a write is still in flight is skipped — the next tick or
  // the terminal flush picks the content up — so writes never overlap and
  // storage sees them in order.
  const flush = (): Promise<void> => {
    if (inflight) return inflight;
    if (!dirty || !messageId || !lastSnapshot) return Promise.resolve();
    dirty = false;
    const snapshot = lastSnapshot;
    inflight = storage.messages
      .update(messageId, snapshot)
      .catch((e: unknown) => {
        // A failed periodic write must not kill the stream; the terminal
        // write retries with the final content.
        logger.warn("[stream] periodic persist failed", e);
        dirty = true;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  const timer = setInterval(() => {
    void flush();
  }, intervalMs);

  // Stop the timer and wait for an in-flight periodic write before a
  // terminal write, so the final `update` is always the last one applied.
  const settle = async (): Promise<void> => {
    clearInterval(timer);
    if (inflight) await inflight;
    dirty = false;
  };

  const persistFinal = async (message: ThreadMessageLike): Promise<void> => {
    await settle();
    if (!messageId) {
      const stored = await storage.messages.create(threadId, message);
      messageId = stored.id ?? "";
    } else {
      await storage.messages.update(messageId, message);
    }
  };

  try {
    for await (const result of stream) {
      if ("isEnd" in result) {
        const final = merge(result.responseMessage);

        if (final.status?.type === "incomplete") {
          // Persist the terminal state (error / cancelled) so it survives a
          // reload. The provider's error/stop response carries an empty
          // body, so we keep the last streamed snapshot's content (the
          // partial text already shown) and attach only the status. With no
          // prior delta there is nothing to preserve — save the empty shell
          // plus status; `hasSendableContent` keeps it out of future
          // request history.
          const persisted = {
            ...(lastSnapshot ?? final),
            status: final.status,
          } as ThreadMessageLike;
          await persistFinal(persisted);
          yield {
            type: "message-incomplete",
            message: withId(persisted),
          };
          return;
        }

        if (final?.role === "assistant" && Array.isArray(final.content)) {
          const toolIdx = findPendingToolCall(final);
          if (toolIdx !== -1) {
            await persistFinal(final);

            const toolName = readToolCall(final, toolIdx)?.toolName ?? null;
            const [allowList, mode] = await Promise.all([
              storage.toolPrefs.readAllowAlways(ctx.entityId),
              readToolPermissionMode(
                storage,
                ctx.entityId,
                ctx.defaultToolPermissionMode
              ),
            ]);
            // Whether the call skips the dialog is the permission mode's
            // call (see `resolveAutoAllow`): under "ask" only a tool the
            // user pinned to the persisted "always-allow" list does; "auto"
            // also lets a tool opt in via `requireApproval === false` or via
            // read-only / non-destructive MCP annotations; "allow" runs
            // everything. The list is keyed per server, so the
            // lookup composes the same `${serverType}_${toolName}` token the
            // settings routes and the approval dialog write (DocSpace bug
            // 84009).
            const tool = ctx.tools?.find((t) => t.name === toolName);
            const autoAllow =
              !!toolName &&
              resolveAutoAllow(mode, {
                allowListed: allowList.includes(
                  allowAlwaysToken(tool?.serverType, toolName)
                ),
                requireApproval: tool?.requireApproval,
                annotations: tool?.annotations,
              });

            yield {
              type: "tool-call-pending",
              message: withId(final),
              idx: toolIdx,
              messageId,
              threadId,
              autoAllow,
            };
            return;
          }
        }

        await persistFinal(final);

        yield { type: "message-end", message: withId(final), messageId };
        return;
      }

      const merged = merge(result);
      lastSnapshot = merged;
      if (!inited) {
        const stored = await storage.messages.create(threadId, merged);
        messageId = stored.id ?? "";
        inited = true;
        yield { type: "message-start", message: withId(merged), messageId };
      } else {
        if (messageId) {
          // Persisted lazily — the next timer tick, the terminal write, or
          // the post-loop salvage below writes this content.
          dirty = true;
        }
        yield { type: "message-delta", message: withId(merged), messageId };
      }
    }

    // Providers normally close with a terminal `isEnd` (handled above, which
    // returns). If the stream instead exhausts without one, persist the last
    // coalesced delta so nothing streamed is lost.
    if (dirty && messageId && lastSnapshot) {
      await settle();
      await storage.messages.update(messageId, lastSnapshot);
    }
  } finally {
    // Runs on normal exit, on a thrown error and on generator `return()`
    // (the consumer stopped iterating) — the timer must never outlive the
    // stream. The terminal branches above leave nothing dirty; if we get
    // here with a staged snapshot the stream died early (provider threw,
    // consumer bailed), so salvage it best-effort — the text was already
    // shown, losing it to the interval would be a regression against the
    // per-delta writes this replaced. Errors are swallowed so a storage
    // failure cannot mask the exception that brought us here.
    clearInterval(timer);
    if (dirty && messageId && lastSnapshot) {
      dirty = false;
      try {
        if (inflight) await inflight;
        await storage.messages.update(messageId, lastSnapshot);
      } catch (e) {
        logger.warn("[stream] salvage persist failed", e);
      }
    }
  }
}
