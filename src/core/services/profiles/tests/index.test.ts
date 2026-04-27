import { describe, expect, it } from "vitest";
import * as profilesModule from "../index";

describe("profiles/index re-exports", () => {
  it("exposes the engine", () => {
    expect(typeof profilesModule.ProfilesEngine).toBe("function");
  });
});
