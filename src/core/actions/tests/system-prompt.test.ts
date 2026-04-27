import { describe, expect, it } from "vitest";
import { resolveSystemPrompt } from "../system-prompt";

describe("resolveSystemPrompt", () => {
  it("returns the default when no override is supplied", () => {
    expect(resolveSystemPrompt("default", undefined)).toBe("default");
  });

  it("replaces the default in 'replace' mode", () => {
    expect(
      resolveSystemPrompt("default", { mode: "replace", text: "new" })
    ).toBe("new");
  });

  it("appends in 'append' mode separated by a blank line", () => {
    expect(
      resolveSystemPrompt("default", { mode: "append", text: "extra" })
    ).toBe("default\n\nextra");
  });

  it("supports empty replace text", () => {
    expect(resolveSystemPrompt("default", { mode: "replace", text: "" })).toBe(
      ""
    );
  });

  it("supports empty append text", () => {
    expect(resolveSystemPrompt("default", { mode: "append", text: "" })).toBe(
      "default\n\n"
    );
  });
});
