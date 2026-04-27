import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("preferences/index re-exports", () => {
  it("exposes the engine and defaults", () => {
    expect(typeof mod.PreferencesEngine).toBe("function");
    expect(mod.DEFAULT_PREFERENCES).toBeDefined();
  });
});
