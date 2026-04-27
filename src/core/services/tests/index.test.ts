import { describe, expect, it } from "vitest";
import * as services from "../index";

describe("services/index re-exports", () => {
  it("exposes every engine class", () => {
    const expected = [
      "AIEngine",
      "ProfilesEngine",
      "AssignmentsEngine",
      "ThreadsEngine",
      "ToolsEngine",
      "PromptsEngine",
      "WebSearchEngine",
      "PreferencesEngine",
    ];
    for (const name of expected) {
      expect(typeof (services as Record<string, unknown>)[name]).toBe(
        "function"
      );
    }
    expect(services.DEFAULT_PREFERENCES).toBeDefined();
  });
});
