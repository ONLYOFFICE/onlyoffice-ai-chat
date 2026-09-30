import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildImageRefBlock,
  collectRefIds,
  resolveAttachmentRefs,
} from "../attachment-resolution";
import type { AttachmentsStorage } from "../../storage";

const toolCall = (result: unknown) => ({
  type: "tool-call" as const,
  toolCallId: "c1",
  toolName: "screenshot",
  args: {},
  result,
});

const assistant = (parts: unknown[]): ThreadMessageLike =>
  ({ role: "assistant", content: parts }) as ThreadMessageLike;

const storageWith = (records: unknown[]) =>
  ({
    readManyByIds: vi.fn().mockResolvedValue(records),
  }) as unknown as AttachmentsStorage;

describe("attachment-resolution — tool-result image refs", () => {
  const persisted = JSON.stringify({
    content: [
      { type: "text", text: "Captured" },
      { type: "image", ref: "att-1", mimeType: "image/jpeg" },
      { type: "image", ref: "att-2" },
    ],
    isError: false,
  });

  it("collects refs from MCP image blocks alongside message-part refs", () => {
    const ids = collectRefIds([
      {
        role: "user",
        content: [buildImageRefBlock({ id: "u-1", title: "photo.png" })],
      } as ThreadMessageLike,
      assistant([toolCall(persisted)]),
    ]);
    expect(ids).toEqual(["u-1", "att-1", "att-2"]);
  });

  it("ignores tool results without a ref and non-envelope results", () => {
    expect(
      collectRefIds([
        assistant([
          toolCall(JSON.stringify({ content: [{ type: "text", text: "x" }] })),
          toolCall(JSON.stringify({ data: { ref: "legacy" } })),
          toolCall("plain"),
          toolCall(undefined),
        ]),
      ])
    ).toEqual([]);
  });

  it("hydrates refs back to inline MCP image blocks for the provider", async () => {
    const storage = storageWith([
      { id: "att-1", kind: "image", base64: "data:image/jpeg;base64,AAAA" },
      // Raw base64 (no data: prefix) is accepted too.
      { id: "att-2", kind: "image", base64: "BBBB" },
    ]);
    const [msg] = await resolveAttachmentRefs(
      [assistant([toolCall(persisted)])],
      storage
    );
    const part = (msg.content as unknown as Array<{ result: string }>)[0];
    expect(JSON.parse(part.result)).toEqual({
      content: [
        { type: "text", text: "Captured" },
        { type: "image", data: "AAAA", mimeType: "image/jpeg" },
        { type: "image", data: "BBBB", mimeType: "image/png" },
      ],
      isError: false,
    });
    expect(storage.readManyByIds).toHaveBeenCalledWith(["att-1", "att-2"]);
  });

  it("collapses a missing attachment to an unavailable notice", async () => {
    const [msg] = await resolveAttachmentRefs(
      [assistant([toolCall(persisted)])],
      storageWith([
        { id: "att-1", kind: "image", base64: "data:image/jpeg;base64,A" },
      ])
    );
    const part = (msg.content as unknown as Array<{ result: string }>)[0];
    expect(JSON.parse(part.result).content[2]).toEqual({
      type: "text",
      text: "[image unavailable]",
    });
  });

  it("leaves a tool-call without image refs untouched", async () => {
    const plain = toolCall(
      JSON.stringify({ content: [{ type: "text", text: "no image" }] })
    );
    const storage = storageWith([]);
    const [msg] = await resolveAttachmentRefs([assistant([plain])], storage);
    expect((msg.content as unknown[])[0]).toBe(plain);
    expect(storage.readManyByIds).not.toHaveBeenCalled();
  });
});
