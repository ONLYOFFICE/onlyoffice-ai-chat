import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("ai/index re-exports", () => {
  it("exposes the engine", () => {
    expect(typeof mod.AIEngine).toBe("function");
  });
});
