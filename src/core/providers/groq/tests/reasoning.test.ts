import { describe, expect, it } from "vitest";
import { getGroqReasoningSupport } from "../reasoning";

describe("getGroqReasoningSupport", () => {
  it("distinguishes the Qwen generations and GPT-OSS", () => {
    expect(getGroqReasoningSupport("qwen/qwen3.6-27b")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["medium"],
    });
    expect(getGroqReasoningSupport("qwen/qwen3.8-27b").depths).toEqual([
      "low",
      "medium",
      "high",
    ]);
    // Groq documents none / default only for qwen3-32b.
    expect(getGroqReasoningSupport("qwen/qwen3-32b").depths).toEqual([
      "medium",
    ]);
    expect(getGroqReasoningSupport("openai/gpt-oss-120b")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high"],
    });
  });

  it("knows the models without reasoning", () => {
    expect(getGroqReasoningSupport("llama-3.3-70b-versatile").thinks).toBe(
      false
    );
  });
});
