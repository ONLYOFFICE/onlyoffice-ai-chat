import { describe, expect, it } from "vitest";
import { resolveSystemPrompt } from "../../system-prompt";
import { systemPrompt } from "../prompt";

/**
 * Bug 83837: asked whether it can work with an attached picture, the model
 * answered that it has no tool to view a standalone image file — while the
 * image was in fact delivered inline with the message. The default chat
 * prompt must say that attachments arrive with the message and that images
 * need no tool, so the model does not infer the opposite from its tool list.
 */
describe("chat systemPrompt", () => {
  it("tells the model that attached images are delivered inline", () => {
    expect(systemPrompt).toMatch(/attach(ed)? images? and files/i);
    expect(systemPrompt).toMatch(/image is delivered to you inline/i);
    expect(systemPrompt).toMatch(/no tool is needed to view it/i);
  });

  it("forbids claiming it cannot see an attachment", () => {
    expect(systemPrompt).toMatch(/never tell the user that you cannot see/i);
  });

  it("keeps the attachment note when a host appends its own prompt", () => {
    const resolved = resolveSystemPrompt(systemPrompt, {
      mode: "append",
      text: "Write local file links as markdown.",
    });
    expect(resolved).toContain("image is delivered to you inline");
    expect(resolved.endsWith("Write local file links as markdown.")).toBe(true);
  });
});
