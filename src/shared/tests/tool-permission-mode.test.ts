import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOOL_PERMISSION_MODE,
  TOOL_PERMISSION_MODES,
  isToolPermissionMode,
} from "../tool-permission-mode";

describe("tool permission mode", () => {
  it("defaults to auto approve", () => {
    expect(DEFAULT_TOOL_PERMISSION_MODE).toBe("auto");
    expect(TOOL_PERMISSION_MODES).toEqual(["ask", "auto", "allow"]);
  });

  it("recognises only the three modes", () => {
    for (const mode of TOOL_PERMISSION_MODES) {
      expect(isToolPermissionMode(mode)).toBe(true);
    }
    expect(isToolPermissionMode("off")).toBe(false);
    expect(isToolPermissionMode(undefined)).toBe(false);
    expect(isToolPermissionMode(1)).toBe(false);
  });
});
