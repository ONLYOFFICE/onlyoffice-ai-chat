import { describe, expect, it } from "vitest";
import { allowAlwaysToken } from "../allow-always";

describe("allowAlwaysToken", () => {
  it("composes `${serverType}_${toolName}` for a bare MCP tool name", () => {
    expect(allowAlwaysToken("calculator", "get_time")).toBe(
      "calculator_get_time"
    );
  });

  it("keeps a name that already carries its group prefix", () => {
    expect(allowAlwaysToken("host", "host_get_weather")).toBe(
      "host_get_weather"
    );
  });

  it("falls back to the bare name when the group is unknown", () => {
    expect(allowAlwaysToken(undefined, "get_time")).toBe("get_time");
    expect(allowAlwaysToken("", "get_time")).toBe("get_time");
  });

  it("does not treat a shared word as the prefix", () => {
    // `get` is not the server here — only an exact `${serverType}_` prefix
    // counts as already qualified.
    expect(allowAlwaysToken("calculator", "calculators_x")).toBe(
      "calculator_calculators_x"
    );
  });
});
