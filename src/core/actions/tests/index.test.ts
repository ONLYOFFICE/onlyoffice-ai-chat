import { describe, expect, it } from "vitest";
import * as actions from "../index";

describe("actions/index re-exports", () => {
  it("exposes resolveSystemPrompt", () => {
    expect(typeof actions.resolveSystemPrompt).toBe("function");
  });

  it("exposes every action function", () => {
    const expected = [
      "chat",
      "custom",
      "customSync",
      "summarize",
      "translate",
      "analyzeText",
      "generateImage",
      "recognizeText",
      "describeImage",
      "generateTitle",
    ] as const;
    for (const name of expected) {
      expect(typeof (actions as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
