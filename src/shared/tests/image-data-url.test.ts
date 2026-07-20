import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isImageDataUrl,
  parseGuardedImageDataUrl,
  parseImageDataUrl,
} from "../image-data-url";
import logger from "../logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseImageDataUrl", () => {
  it("splits a base64 data URL into mime + payload", () => {
    expect(parseImageDataUrl("data:image/png;base64,AAAB")).toEqual({
      mimeType: "image/png",
      base64: "AAAB",
    });
  });

  it("returns null for a non-data URL", () => {
    expect(parseImageDataUrl("https://host/a.png")).toBeNull();
  });

  it("returns null for an empty base64 payload", () => {
    expect(parseImageDataUrl("data:image/png;base64,")).toBeNull();
  });
});

describe("isImageDataUrl", () => {
  it("is true only for a base64 data URL", () => {
    expect(isImageDataUrl("data:image/jpeg;base64,ZZ")).toBe(true);
    expect(isImageDataUrl("https://host/a.png")).toBe(false);
    expect(isImageDataUrl('{"ref":"x"}')).toBe(false);
    expect(isImageDataUrl(undefined)).toBe(false);
  });
});

describe("parseGuardedImageDataUrl", () => {
  it("returns the parsed data URL without warning", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(parseGuardedImageDataUrl("data:image/png;base64,QQ")).toEqual({
      mimeType: "image/png",
      base64: "QQ",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and returns null for a ref JSON value", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(
      parseGuardedImageDataUrl(
        JSON.stringify({ ref: "a", title: "t", kind: "image" })
      )
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns and returns null for an http(s) URL", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(
      parseGuardedImageDataUrl("https://host/storage/files/x.png")
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns null WITHOUT warning for the benign empty string", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(parseGuardedImageDataUrl("")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null for a non-string value", () => {
    expect(parseGuardedImageDataUrl(undefined)).toBeNull();
    expect(parseGuardedImageDataUrl(null)).toBeNull();
  });
});
