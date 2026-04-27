import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("assignments/index re-exports", () => {
  it("exposes the engine and the requirements helpers", () => {
    expect(typeof mod.AssignmentsEngine).toBe("function");
    expect(typeof mod.meetsRequirements).toBe("function");
    expect(mod.ACTION_REQUIREMENTS).toBeDefined();
  });
});
