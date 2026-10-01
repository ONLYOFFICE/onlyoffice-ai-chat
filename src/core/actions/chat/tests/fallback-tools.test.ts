import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import { transformHistoryToText } from "../fallback-tools";

describe("transformHistoryToText — tool-result images", () => {
  it("swaps inline images for a placeholder instead of pasting base64", () => {
    const result = JSON.stringify({
      content: [
        { type: "text", text: "Captured" },
        { type: "image", data: "AAAA", mimeType: "image/png" },
      ],
    });
    const out = transformHistoryToText([
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "c1",
            toolName: "screenshot",
            args: {},
            result,
          },
        ],
      } as unknown as ThreadMessageLike,
    ]);

    const toolResult = out.find((m) => m.role === "user")?.content as string;
    expect(toolResult).toContain("[image attached]");
    expect(toolResult).not.toContain("AAAA");
  });
});
