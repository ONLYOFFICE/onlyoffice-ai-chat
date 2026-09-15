import { useCallback, useEffect, useRef, useState } from "react";
import { useStores } from "../store/context";

/**
 * What a key press did, so the caller knows whether to swallow the event.
 *
 * `null` means "not ours" — the caret was mid-text, or we're already at
 * the end of the list — and the textarea must keep its native caret
 * movement.
 */
export type PromptHistoryStep = { text: string } | null;

/** Marks "this hook has not loaded any scope yet" — see `loadedScopeRef`. */
const NEVER_LOADED = Symbol("never-loaded");

/**
 * Last known history per scope, shared by every hook instance.
 *
 * The composer is not one continuous component: assistant-ui renders a
 * different subtree for an empty thread than for one with messages, so
 * sending the first message *unmounts* the composer that recorded the
 * prompt and mounts a fresh one. Instance state alone would lose that
 * prompt exactly when the user reaches for it with Up.
 *
 * It also covers the read/write race behind the same keystroke: the new
 * instance's `list()` can be served before the `record()` write lands,
 * which would answer "no history" for a prompt we know was just sent.
 * The cache is the authority for what the user typed; storage catches up
 * behind it.
 */
const historyCache = new Map<string, string[]>();

/** Cache key — `undefined` (a new, unnamed chat) gets its own bucket. */
const cacheKey = (scopeId?: string) => scopeId ?? "";

/**
 * The one in-flight "name this new chat's prompt" claim, if any.
 *
 * `record` in an unnamed chat can't persist yet — the thread id arrives
 * with the send — so it waits on the threads store. That wait outlives
 * the composer by design (the send itself unmounts it), which is exactly
 * why it needs tracking here rather than in instance state:
 *
 * - it must be cancellable, or an aborted send leaves a listener that
 *   attributes its dead prompt to whatever unrelated chat is named next;
 * - the loader needs to know a claim is pending to tell "my own send is
 *   naming this chat" from "the user just opened a different thread".
 *
 * Only one can be outstanding: a second unnamed `record` supersedes the
 * first (both prompts are already in the same new-chat bucket, which the
 * claim hands over wholesale).
 */
let pendingClaim: { cancel: () => void } | null = null;

/** Drop a pending claim without persisting it. */
function cancelPendingClaim() {
  pendingClaim?.cancel();
  pendingClaim = null;
}

/**
 * Drop every cached scope. Exported for tests, which would otherwise
 * leak one case's prompts into the next through module state.
 */
export function __resetPromptHistoryCache() {
  historyCache.clear();
  cancelPendingClaim();
}

export interface PromptHistory {
  /** Walk one entry towards the past (Up). */
  previous: (currentText: string) => PromptHistoryStep;
  /**
   * Walk one entry towards the present (Down). Stepping past the newest
   * entry restores the draft that was in the box when the walk started —
   * the same "back to where I was" the shell gives you.
   */
  next: () => PromptHistoryStep;
  /** Record a sent prompt and rewind the cursor to the newest end. */
  record: (text: string) => void;
  /** True while the user is walking the list rather than typing. */
  isBrowsing: boolean;
  /** Abandon the walk — called whenever the user edits the draft. */
  reset: () => void;
}

/**
 * Terminal-style history for the composer, scoped to the currently open
 * thread so each chat walks back through its own prompts and a new chat
 * starts empty.
 *
 * A brand-new chat has no thread id until the first send creates one, so
 * its history starts empty and the prompts typed there are attributed to
 * the thread the send produces — see `record`.
 *
 * The list is loaded once per thread and then maintained in memory:
 * every send appends locally *and* persists, so walking history never
 * waits on a round-trip.
 */
export function usePromptHistory(): PromptHistory {
  const { api, useThreadsStore, useMessageStore } = useStores();
  const threadId = useThreadsStore((s) => s.threadId);
  // Read lazily, never subscribed: this must not re-render the composer on
  // every streamed token.
  const hasMessages = useCallback(
    () => useMessageStore.getState().messages.length > 0,
    [useMessageStore]
  );
  // Empty means "new chat" — an unsaved thread, whose history is the
  // in-memory list below until the send names it.
  const scopeId = threadId || undefined;

  // Oldest first / newest last — the shape the storage contract returns,
  // so Up walks backwards from `items.length`.
  const itemsRef = useRef<string[]>([]);
  // Index into `itemsRef`. `items.length` means "not browsing" — the box
  // holds the user's own draft rather than a history entry.
  const cursorRef = useRef(0);
  // The draft that was in the box when the walk started, restored when
  // the user walks back past the newest entry.
  const draftRef = useRef("");
  const [isBrowsing, setIsBrowsing] = useState(false);
  // The scope the current `itemsRef` belongs to, so the loader can tell a
  // real thread switch (drop the list) from a new chat being named by its
  // own first send (keep it — see the effect below). `NEVER_LOADED` is a
  // distinct sentinel because `undefined` is itself a real scope — the
  // new-chat one — and mounting straight into a thread must still load.
  const loadedScopeRef = useRef<string | undefined | typeof NEVER_LOADED>(
    NEVER_LOADED
  );

  const reset = useCallback(() => {
    cursorRef.current = itemsRef.current.length;
    draftRef.current = "";
    setIsBrowsing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // A new chat gets its id from its own first send, so this effect
    // re-runs mid-send with prompts already in the list — and the write
    // `record` just fired against that new id is still in flight. Wiping
    // and re-reading here would race that write and lose the chat's first
    // prompt. The list is already this thread's history, so adopt it.
    // `pendingClaim` is what separates that from the other way an unnamed
    // scope turns into a real one: the user picking an existing thread
    // out of the list while sitting on the empty new-chat view. That
    // looks identical here — "" → some id, no unmount — but has no send
    // behind it, so its history must be loaded normally.
    const loadedScope = loadedScopeRef.current;
    const wasNewChat = loadedScope !== NEVER_LOADED && loadedScope === undefined;
    const adopted = wasNewChat && !!scopeId && !!pendingClaim;
    loadedScopeRef.current = scopeId;
    if (adopted) return;

    // An unnamed chat — either a genuinely new one, or the one whose own
    // first send is still in flight. They must behave differently (clear
    // vs. keep the recorded prompt) and the scope alone cannot tell them
    // apart: the thread is named asynchronously, so the composer that
    // recorded the prompt is unmounted and replaced while the id is still
    // empty. Messages are the reliable signal — starting a new chat
    // clears them, while a send has already put the user's message in the
    // list by the time this runs.
    if (!scopeId) {
      if (!hasMessages()) {
        historyCache.delete(cacheKey(undefined));
        // Starting a genuinely new chat also retires any claim left over
        // by an earlier send that never named a thread (aborted, failed,
        // panel closed). Left alive, it would wake on *this* chat's id
        // and file the abandoned prompt against it.
        cancelPendingClaim();
      }
      itemsRef.current = [...(historyCache.get(cacheKey(undefined)) ?? [])];
      reset();
      // Nothing persisted yet, and reading the unscoped bucket via the API
      // would show prompts from every other chat.
      return;
    }

    // Landing in a real thread that is *not* the one a pending send is
    // naming (that case returned at `adopted` above) means the user
    // navigated away from the unnamed chat. Retire the claim rather than
    // let it file the abandoned prompt against this thread.
    cancelPendingClaim();

    // A real thread switch: the previous chat's prompts must not stay in
    // the box's history. Remounting into a scope we already know (the
    // empty → non-empty composer swap) starts from the cache instead, so
    // a just-sent prompt is walkable before storage has caught up.
    itemsRef.current = [...(historyCache.get(cacheKey(scopeId)) ?? [])];
    reset();
    void api.promptHistory.list(scopeId).then((items) => {
      if (cancelled) return;
      // The stored list may still be missing a prompt recorded moments
      // ago, so let the cached tail win rather than truncating it away.
      const cached = historyCache.get(cacheKey(scopeId)) ?? [];
      const merged = items.length >= cached.length ? items : cached;
      historyCache.set(cacheKey(scopeId), merged);
      itemsRef.current = [...merged];
      cursorRef.current = merged.length;
    });
    return () => {
      cancelled = true;
    };
  }, [api, scopeId, reset, hasMessages]);

  const previous = useCallback((currentText: string): PromptHistoryStep => {
    const items = itemsRef.current;
    if (items.length === 0) return null;
    // Already at the oldest entry — swallow nothing further, but don't
    // hand back a step either.
    if (cursorRef.current <= 0) return null;
    // First step of a walk: remember what the user had typed so Down can
    // bring it back.
    if (cursorRef.current === items.length) {
      draftRef.current = currentText;
    }
    cursorRef.current -= 1;
    setIsBrowsing(true);
    return { text: items[cursorRef.current] ?? "" };
  }, []);

  const next = useCallback((): PromptHistoryStep => {
    const items = itemsRef.current;
    // Not browsing — Down belongs to the textarea.
    if (cursorRef.current >= items.length) return null;
    cursorRef.current += 1;
    if (cursorRef.current === items.length) {
      // Walked back past the newest entry: restore the draft and leave
      // browsing mode.
      const draft = draftRef.current;
      draftRef.current = "";
      setIsBrowsing(false);
      return { text: draft };
    }
    return { text: items[cursorRef.current] ?? "" };
  }, []);

  const record = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        reset();
        return;
      }
      const items = itemsRef.current;
      // Mirror the engine's dedup rule locally so the in-memory list and
      // the persisted one stay in step without a read-back.
      if (items[items.length - 1] !== trimmed) items.push(trimmed);
      // Publish before the composer can be torn down by this very send.
      historyCache.set(cacheKey(scopeId), [...items]);
      reset();
      if (scopeId) {
        void api.promptHistory.record(trimmed, scopeId);
        return;
      }
      // First send in a new chat: the thread is created by this very send,
      // so its id doesn't exist yet. Wait for the store to publish it and
      // persist against it, instead of dropping the prompt into the
      // unscoped bucket every other chat would then see.
      //
      // Deliberately NOT tied to this component's lifetime: the same send
      // makes the thread non-empty, which unmounts this composer before
      // the id arrives. Cancelling on unmount would throw away the write
      // every single time. It is tracked module-side instead, so a send
      // that never names a thread can be cancelled when the next new chat
      // starts rather than claiming that chat's id — see `pendingClaim`.
      cancelPendingClaim();
      const unsubscribe = useThreadsStore.subscribe((state, prev) => {
        if (!state.threadId || state.threadId === prev.threadId) return;
        unsubscribe();
        pendingClaim = null;
        // Hand the unnamed chat's prompts to the thread that now owns
        // them, so a composer mounting under the new id finds them, and
        // clear the new-chat bucket for the next new chat.
        const pending = historyCache.get(cacheKey(undefined)) ?? [];
        const existing = historyCache.get(state.threadId) ?? [];
        historyCache.set(state.threadId, [...existing, ...pending]);
        historyCache.delete(cacheKey(undefined));
        void api.promptHistory.record(trimmed, state.threadId);
      });
      pendingClaim = { cancel: unsubscribe };
    },
    [api, scopeId, reset, useThreadsStore]
  );

  return { previous, next, record, isBrowsing, reset };
}
