import { describe, expect, it } from "vitest";
import * as core from "../index";

describe("core/index re-exports", () => {
  it("exposes provider, action, storage, and service surfaces", () => {
    // Providers
    expect(typeof core.AbstractBaseProvider).toBe("function");
    expect(typeof core.createProvider).toBe("function");
    expect(typeof core.registerProvider).toBe("function");

    // Actions
    expect(typeof core.chat).toBe("function");
    expect(typeof core.summarize).toBe("function");

    // Services
    expect(typeof core.AIEngine).toBe("function");
    expect(typeof core.ProfilesEngine).toBe("function");
  });
});
