import { describe, expect, it } from "vitest";
import { CURRENT_MODEL_KEY } from "../constants";

describe("constants", () => {
  it("CURRENT_MODEL_KEY is the stable storage key for the active model", () => {
    expect(CURRENT_MODEL_KEY).toBe("current-model");
  });
});
