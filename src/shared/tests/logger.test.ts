import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import logger from "../logger";

describe("logger", () => {
  const originalLog = globalThis.console.log;
  const originalWarn = globalThis.console.warn;
  const originalError = globalThis.console.error;
  const originalInfo = globalThis.console.info;

  beforeEach(() => {
    globalThis.console.log = vi.fn();
    globalThis.console.warn = vi.fn();
    globalThis.console.error = vi.fn();
    globalThis.console.info = vi.fn();
  });

  afterEach(() => {
    globalThis.console.log = originalLog;
    globalThis.console.warn = originalWarn;
    globalThis.console.error = originalError;
    globalThis.console.info = originalInfo;
  });

  it("delegates log to console.log", () => {
    logger.log("hello", 42);
    expect(globalThis.console.log).toHaveBeenCalledWith("hello", 42);
  });

  it("delegates warn to console.warn", () => {
    logger.warn("warning!");
    expect(globalThis.console.warn).toHaveBeenCalledWith("warning!");
  });

  it("delegates error to console.error", () => {
    logger.error("oops", { detail: true });
    expect(globalThis.console.error).toHaveBeenCalledWith("oops", {
      detail: true,
    });
  });

  it("delegates info to console.info", () => {
    logger.info("info msg");
    expect(globalThis.console.info).toHaveBeenCalledWith("info msg");
  });

  it("passes multiple arguments", () => {
    logger.log("a", "b", "c", 1, 2, 3);
    expect(globalThis.console.log).toHaveBeenCalledWith("a", "b", "c", 1, 2, 3);
  });
});
