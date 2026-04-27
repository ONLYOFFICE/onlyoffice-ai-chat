import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("tools/index re-exports", () => {
  it("exposes engine and validation helpers", () => {
    expect(typeof mod.ToolsEngine).toBe("function");
    expect(typeof mod.validateServerName).toBe("function");
    expect(typeof mod.validateTransportConfig).toBe("function");
  });
});
