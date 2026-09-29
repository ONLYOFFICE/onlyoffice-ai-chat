import { useThreadViewport } from "@assistant-ui/react";
import { useStores } from "../../../store/context";
import { isEmptyAssistantMessage } from "./AssistantMessage";

/**
 * How much room above the fold a question is allowed to keep. Mirrors
 * `ThreadPrimitive.ViewportSlack`'s own `fillClampOffset` (`6em`) so the gap
 * this component holds and the one the runtime takes over with are the same
 * size — resolved here against the root font size, since the element the
 * runtime measures its `em` against does not exist yet.
 */
const FILL_CLAMP_OFFSET_REM = 6;

/**
 * Holds the scroll room for a question that has no answer yet.
 *
 * Under `turnAnchor="top"` the runtime lifts the last user message to the top
 * of the message area by giving the assistant message below it a `min-height`
 * of the rest of the viewport (`ThreadPrimitive.ViewportSlack`) and scrolling
 * to the bottom when the run starts. That slack rides on the assistant
 * message's `MessagePrimitive.Root` — so it exists only once an assistant
 * message is actually *rendered*, which is later than it sounds twice over:
 * the message is not added to the thread until the first chunk of the
 * response arrives, and `AssistantMessage` renders `null` for one with no
 * content yet (an empty in-flight placeholder is not a bubble worth showing).
 * For that whole window the thread is one message taller than the runtime has
 * room for: the question sits at the bottom against the composer, exactly
 * where it was before this layout, and snaps to the top when the first token
 * lands.
 *
 * This fills that window with the same measurement the runtime uses, so the
 * question rises to the top on send and stays there when the real slack takes
 * over. It is rendered below the thread's own footer but deliberately outside
 * it: sized from `inset`, it would otherwise be measured as part of the inset
 * it reads and collapse to nothing.
 *
 * Renders an empty spacer, and nothing at all once the answer is on screen.
 */
export const PendingTurnSlack = () => {
  const { useMessageStore } = useStores();
  const viewport = useThreadViewport((s) => s.height.viewport);
  const inset = useThreadViewport((s) => s.height.inset);
  const turnAnchor = useThreadViewport((s) => s.turnAnchor);

  // The window this component covers: a run is in flight and nothing of the
  // answer is on screen yet — either the thread still ends with the question,
  // or it ends with an assistant message that renders to nothing. Subscribing
  // to the derived boolean rather than to `messages` keeps this out of the
  // per-token render path: it flips exactly twice per turn, and the content
  // test below only ever runs against an empty or nearly empty message.
  const isAwaitingAnswer = useMessageStore((s) => {
    if (!s.isStreamRunning) return false;
    const last = s.messages.at(-1);
    if (!last) return false;
    if (last.role === "user") return true;
    return last.role === "assistant" && isEmptyAssistantMessage(last);
  });

  if (turnAnchor !== "top" || !isAwaitingAnswer) return null;

  // The question's own height is what the runtime subtracts, and it is
  // registered with the viewport store only once an assistant message
  // follows it (`MessagePrimitive.Root`) — i.e. never during this window.
  // Clamping at the offset is the same fallback the runtime applies to a
  // question taller than the threshold, so a long question keeps its last
  // lines on screen instead of being pushed off the top.
  const height = Math.max(0, viewport - inset - remToPx(FILL_CLAMP_OFFSET_REM));

  return <div aria-hidden="true" className="shrink-0" style={{ height }} />;
};

function remToPx(value: number): number {
  if (typeof document === "undefined") return value * 16;
  const root =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return value * root;
}
