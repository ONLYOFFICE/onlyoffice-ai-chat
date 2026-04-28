import { afterEach, describe, expect, it } from "vitest";
import {
  SYSTEM_PROMPT,
  CREATE_TITLE_SYSTEM_PROMPT,
  buildSystemPrompt,
  getSystemPromptAppendix,
  setSystemPromptAppendix,
} from "../prompts";

afterEach(() => setSystemPromptAppendix(""));

describe("system prompt", () => {
  it("exports stable prompt strings", () => {
    expect(SYSTEM_PROMPT).toContain("AI assistant");
    expect(CREATE_TITLE_SYSTEM_PROMPT).toContain("chat titles");
  });

  it("getSystemPromptAppendix defaults to empty", () => {
    expect(getSystemPromptAppendix()).toBe("");
  });

  it("setSystemPromptAppendix stores string and ignores non-string", () => {
    setSystemPromptAppendix("hello");
    expect(getSystemPromptAppendix()).toBe("hello");
    setSystemPromptAppendix(undefined as unknown as string);
    expect(getSystemPromptAppendix()).toBe("");
  });

  it("buildSystemPrompt appends trimmed appendix when present", () => {
    expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
    setSystemPromptAppendix("  extra rules  ");
    expect(buildSystemPrompt()).toBe(`${SYSTEM_PROMPT}\n\nextra rules`);
  });

  it("buildSystemPrompt skips empty/whitespace appendix", () => {
    setSystemPromptAppendix("   ");
    expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
  });
});
