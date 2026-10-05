import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { readToolPermissionMode, resolveAutoAllow } from "../auto-allow";

describe("resolveAutoAllow", () => {
  it("ask: nothing skips the dialog, not even the always-allow list", () => {
    expect(resolveAutoAllow("ask", { allowListed: true })).toBe(false);
    expect(
      resolveAutoAllow("ask", { allowListed: true, requireApproval: false })
    ).toBe(false);
    expect(
      resolveAutoAllow("ask", { allowListed: false, requireApproval: false })
    ).toBe(false);
    expect(resolveAutoAllow("ask", { allowListed: false })).toBe(false);
  });

  it("auto: the list or the tool's own opt-out", () => {
    expect(resolveAutoAllow("auto", { allowListed: true })).toBe(true);
    expect(
      resolveAutoAllow("auto", { allowListed: false, requireApproval: false })
    ).toBe(true);
    expect(
      resolveAutoAllow("auto", { allowListed: false, requireApproval: true })
    ).toBe(false);
    expect(resolveAutoAllow("auto", { allowListed: false })).toBe(false);
  });

  it("auto: read-only or explicitly non-destructive annotations run, destructive or missing ask", () => {
    const run = (annotations?: Record<string, unknown>) =>
      resolveAutoAllow("auto", { allowListed: false, annotations });
    expect(run({ readOnlyHint: true })).toBe(true);
    expect(run({ readOnlyHint: false, destructiveHint: false })).toBe(true);
    expect(run({ destructiveHint: false })).toBe(true);
    expect(run({ readOnlyHint: false, destructiveHint: true })).toBe(false);
    expect(run({ readOnlyHint: false })).toBe(false);
    expect(run({})).toBe(false);
    expect(run(undefined)).toBe(false);
    // Only literal booleans count.
    expect(run({ readOnlyHint: "true" })).toBe(false);
  });

  it("ask: annotations never skip the dialog", () => {
    expect(
      resolveAutoAllow("ask", {
        allowListed: false,
        annotations: { readOnlyHint: true },
      })
    ).toBe(false);
    expect(
      resolveAutoAllow("ask", {
        allowListed: true,
        annotations: { readOnlyHint: true },
      })
    ).toBe(false);
  });

  it("allow: everything runs", () => {
    expect(
      resolveAutoAllow("allow", { allowListed: false, requireApproval: true })
    ).toBe(true);
    expect(resolveAutoAllow("allow", { allowListed: false })).toBe(true);
  });
});

describe("readToolPermissionMode", () => {
  it("returns the stored mode in scope", async () => {
    const read = vi.fn().mockResolvedValue("allow");
    const storage = {
      preferences: { readToolPermissionMode: read },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(storage, "room")).toBe("allow");
    expect(read).toHaveBeenCalledWith("room");
  });

  it("falls back to auto when nothing is stored or the adapter has no mode methods", async () => {
    const none = {
      preferences: { readToolPermissionMode: vi.fn().mockResolvedValue(null) },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(none)).toBe("auto");
    const legacy = { preferences: {} } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(legacy)).toBe("auto");
    const bare = {} as unknown as StorageAdapter;
    expect(await readToolPermissionMode(bare)).toBe("auto");
  });

  it("honours the host's fallback and ignores a value that is not a mode", async () => {
    const none = {
      preferences: { readToolPermissionMode: vi.fn().mockResolvedValue(null) },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(none, undefined, "ask")).toBe("ask");
    const junk = {
      preferences: {
        readToolPermissionMode: vi.fn().mockResolvedValue("yolo"),
      },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(junk)).toBe("auto");
    expect(await readToolPermissionMode(junk, undefined, "ask")).toBe("ask");
  });
});
