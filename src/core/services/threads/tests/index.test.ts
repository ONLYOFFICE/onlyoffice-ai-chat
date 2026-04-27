import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("threads/index re-exports", () => {
  it("exposes the engine", () => {
    expect(typeof mod.ThreadsEngine).toBe("function");
  });
});
