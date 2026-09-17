import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { hasSendableContent } from "../../../services/ai/stream";
import { convertMessages } from "../messages";
import { convertMessagesToModelFormat } from "../utils";

/**
 * A round the user stopped while Claude was still thinking. The signature
 * arrives only when the thinking block closes, so the persisted reasoning
 * part has no `parentId`; the engine keeps the partial content and stamps
 * the cancelled status (Bug 83732).
 */
const stoppedWhileThinking = {
  role: "assistant",
  content: [{ type: "reasoning", text: "The user wants me to paraph" }],
  status: { type: "incomplete", reason: "cancelled" },
} as ThreadMessageLike;

/** The same stop on an OpenAI-compatible stream, which closes reasoning with an empty text part. */
const stoppedWithEmptyText = {
  role: "assistant",
  content: [
    { type: "reasoning", text: "partial", parentId: "reasoning-1-a" },
    { type: "text", text: "" },
  ],
  status: { type: "incomplete", reason: "cancelled" },
} as ThreadMessageLike;

const history = (stopped: ThreadMessageLike): ThreadMessageLike[] => {
  const thread: ThreadMessageLike[] = [
    { role: "user", content: "Paraphrase the text." },
    stopped,
    { role: "user", content: "Create a table." },
  ];
  return thread.filter(hasSendableContent);
};

describe.each([
  ["messages.convertMessages", convertMessages],
  ["utils.convertMessagesToModelFormat", convertMessagesToModelFormat],
])("anthropic %s — stopped turn", (_name, convert) => {
  it("sends no thinking block for reasoning that never got its signature", () => {
    const out = convert(history(stoppedWhileThinking));
    expect(out).toEqual([
      { role: "user", content: "Paraphrase the text." },
      { role: "user", content: "Create a table." },
    ]);
  });

  it("sends no empty text block either", () => {
    const out = convert(history(stoppedWithEmptyText));
    expect(out.map((m) => m.role)).toEqual(["user", "user"]);
  });

  it("drops a blank text part but keeps the rest of the turn", () => {
    const out = convert([
      {
        role: "assistant",
        content: [
          { type: "text", text: "   " },
          { type: "text", text: "Here you go." },
        ],
      } as ThreadMessageLike,
    ]);
    expect(out).toEqual([
      { role: "assistant", content: [{ type: "text", text: "Here you go." }] },
    ]);
  });
});
