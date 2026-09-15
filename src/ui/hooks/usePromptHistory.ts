import { useCallback, useRef, useState } from "react";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { useStores } from "../store/context";

/**
 * What a key press did, so the caller knows whether to swallow the event.
 *
 * `null` means "not ours" — the caret was mid-text, or the walk has
 * reached the beginning of the thread — and the textarea must keep its
 * native caret movement.
 */
export type PromptHistoryStep = { text: string } | null;

/** The text of a user message, the way the thread itself renders it. */
function promptOf(message: ThreadMessageLike): string {
  if (message.role !== "user") return "";
  const content = message.content;
  // A user message can be a bare string as well as a part list — the
  // runtime accepts both, and a thread loaded from a host's storage is
  // whatever that host wrote.
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/**
 * The thread's prompts, oldest first — the same order the composer walks
 * backwards through. Empty user messages (an attachment-only send) carry
 * nothing to recall, so they are not entries.
 */
function promptsOf(messages: ThreadMessageLike[]): string[] {
  const prompts: string[] = [];
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = promptOf(message).trim();
    if (text) prompts.push(text);
  }
  return prompts;
}

export interface PromptHistory {
  /**
   * Walk one entry towards the past (Up).
   *
   * Asynchronous because the thread is paginated: the loaded window holds
   * the newest {@link PAGE_SIZE} messages, so a walk long enough to reach
   * its top has to pull the page before it and continue there.
   */
  previous: (currentText: string) => Promise<PromptHistoryStep>;
  /**
   * Walk one entry towards the present (Down). Stepping past the newest
   * entry restores the draft that was in the box when the walk started —
   * the same "back to where I was" the shell gives you.
   *
   * Synchronous in effect (the entries it walks are already loaded), but
   * typed like `previous` so the caller handles one shape.
   */
  next: () => Promise<PromptHistoryStep>;
  /** True while the user is walking the list rather than typing. */
  isBrowsing: boolean;
  /** Abandon the walk — called whenever the user edits the draft. */
  reset: () => void;
}

/**
 * Terminal-style history for the composer, read straight from the open
 * thread's own user messages.
 *
 * There is no separate record of what was sent: the thread *is* the
 * history, so a prompt is walkable the moment its message is in the
 * store — including the first send of a brand-new chat, which lands in
 * the list before the thread even has an id. Switching threads switches
 * the history with it, and a new chat starts empty, both for free.
 *
 * Only the newest page of a thread is loaded up front (see
 * `MessageStoreState.loadOlderMessages`). The cursor is therefore held
 * as a distance from the *end* of the list rather than an index into it:
 * when the walk runs past the oldest loaded prompt the previous page is
 * pulled in, which grows the list at the front and would shift any
 * absolute index out from under it.
 */
export function usePromptHistory(): PromptHistory {
  const { useMessageStore } = useStores();

  // Read lazily, never subscribed: this must not re-render the composer
  // on every streamed token.
  const readPrompts = useCallback(
    () => promptsOf(useMessageStore.getState().messages),
    [useMessageStore]
  );

  // How far back from the newest prompt the box currently sits. 0 means
  // "not browsing" — the box holds the user's own draft rather than a
  // history entry — and `n` means "the nth prompt from the end".
  const depthRef = useRef(0);
  // The draft that was in the box when the walk started, restored when
  // the user walks back past the newest entry.
  const draftRef = useRef("");
  const [isBrowsing, setIsBrowsing] = useState(false);
  // Set while a step is waiting on an older page. Holding Up down fires
  // a key repeat every few dozen milliseconds — far faster than a page
  // comes back — and each of those would read the same depth and walk
  // from it, so all but one of the entries in between would be skipped.
  const steppingRef = useRef(false);
  // Bumped by everything that moves the cursor. A step suspended on a
  // page fetch compares it on resume to tell whether the walk it started
  // is still the walk in progress — depth alone cannot say, because a
  // `reset` during the first step puts back the 0 that step read.
  const versionRef = useRef(0);

  const reset = useCallback(() => {
    versionRef.current += 1;
    depthRef.current = 0;
    draftRef.current = "";
    setIsBrowsing(false);
  }, []);

  const previous = useCallback(
    async (currentText: string): Promise<PromptHistoryStep> => {
      if (steppingRef.current) return null;
      const version = versionRef.current;
      let prompts = readPrompts();
      const depth = depthRef.current;

      // Past the oldest loaded prompt: the rest of the thread is still on
      // the server, so pull the page before this one and look again. One
      // page can be all assistant messages, or all attachment-only sends,
      // so keep pulling while it brings nothing walkable and the thread
      // still has more.
      let awaited = false;
      while (depth >= prompts.length) {
        const store = useMessageStore.getState();
        if (!store.hasMoreOlderMessages) return null;
        const before = store.messages.length;
        steppingRef.current = true;
        try {
          await store.loadOlderMessages();
        } finally {
          steppingRef.current = false;
        }
        awaited = true;
        // A load that failed or was refused leaves the list as it was —
        // stop rather than spin on a backend that cannot answer. A page
        // that *did* arrive but held no prompts of its own is not a stop:
        // the walkable ones may simply be another page back.
        //
        // This counts messages rather than prompts on purpose. A page of
        // nothing but assistant replies (or attachment-only sends) adds
        // zero prompts while still being real progress through the
        // thread, so a `prompts.length` comparison here would end the
        // walk on exactly the case the paragraph above keeps going for.
        if (useMessageStore.getState().messages.length === before) return null;
        prompts = readPrompts();
      }

      // The walk was suspended on a page fetch, and the composer does not
      // stand still while it is: typing (`reset`) or Down (`next`) moves
      // the cursor out from under this step, and resuming from the state
      // captured before the await would overwrite the user's own draft
      // with a stale entry.
      if (awaited && versionRef.current !== version) return null;

      // First step of a walk: remember what the user had typed so Down
      // can bring it back.
      if (depth === 0) draftRef.current = currentText;
      depthRef.current = depth + 1;
      setIsBrowsing(true);
      return { text: prompts[prompts.length - depthRef.current] ?? "" };
    },
    [readPrompts, useMessageStore]
  );

  const next = useCallback(async (): Promise<PromptHistoryStep> => {
    // Not browsing — Down belongs to the textarea.
    if (depthRef.current <= 0) return null;
    versionRef.current += 1;
    depthRef.current -= 1;
    if (depthRef.current === 0) {
      // Walked back past the newest entry: restore the draft and leave
      // browsing mode.
      const draft = draftRef.current;
      draftRef.current = "";
      setIsBrowsing(false);
      return { text: draft };
    }
    const prompts = readPrompts();
    return { text: prompts[prompts.length - depthRef.current] ?? "" };
  }, [readPrompts]);

  return { previous, next, isBrowsing, reset };
}
