import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("prompts/index re-exports", () => {
  it("exposes engine + validation helpers", () => {
    expect(typeof mod.PromptsEngine).toBe("function");
    expect(typeof mod.validateFolderName).toBe("function");
    expect(typeof mod.validateFolderReference).toBe("function");
    expect(typeof mod.validatePromptName).toBe("function");
  });
});
