import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import logger, { setLogLevel, getLogLevel } from "../logger";

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
    // Reset the module-global threshold so level tests don't leak into others.
    setLogLevel("debug");
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

  it("defaults to the 'debug' level", () => {
    expect(getLogLevel()).toBe("debug");
  });

  it("suppresses info/debug but keeps warn/error at level 'warn'", () => {
    setLogLevel("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(globalThis.console.info).not.toHaveBeenCalled();
    expect(globalThis.console.warn).toHaveBeenCalledWith("w");
    expect(globalThis.console.error).toHaveBeenCalledWith("e");
  });

  it("emits only errors at level 'error'", () => {
    setLogLevel("error");
    logger.warn("w");
    logger.error("e");
    expect(globalThis.console.warn).not.toHaveBeenCalled();
    expect(globalThis.console.error).toHaveBeenCalledWith("e");
  });

  it("suppresses everything at level 'silent'", () => {
    setLogLevel("silent");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(globalThis.console.info).not.toHaveBeenCalled();
    expect(globalThis.console.warn).not.toHaveBeenCalled();
    expect(globalThis.console.error).not.toHaveBeenCalled();
  });
});
