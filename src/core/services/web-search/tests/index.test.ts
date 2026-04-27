import { describe, expect, it } from "vitest";
import * as mod from "../index";

describe("web-search/index re-exports", () => {
  it("exposes engine + validation helpers", () => {
    expect(typeof mod.WebSearchEngine).toBe("function");
    expect(typeof mod.testWebSearchConnection).toBe("function");
    expect(typeof mod.validateConfigShape).toBe("function");
  });
});
