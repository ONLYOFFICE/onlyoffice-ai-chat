import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../../../storage";
import { readToolPermissionMode, resolveAutoAllow } from "../auto-allow";

describe("resolveAutoAllow", () => {
  it("ask: only the always-allow list skips the dialog", () => {
    expect(resolveAutoAllow("ask", { allowListed: true })).toBe(true);
    expect(
      resolveAutoAllow("ask", { allowListed: true, requireApproval: true })
    ).toBe(true);
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

  it("falls back to ask when nothing is stored or the adapter has no mode methods", async () => {
    const none = {
      preferences: { readToolPermissionMode: vi.fn().mockResolvedValue(null) },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(none)).toBe("ask");
    const legacy = { preferences: {} } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(legacy)).toBe("ask");
    const bare = {} as unknown as StorageAdapter;
    expect(await readToolPermissionMode(bare)).toBe("ask");
  });

  it("honours the host's fallback and ignores a value that is not a mode", async () => {
    const none = {
      preferences: { readToolPermissionMode: vi.fn().mockResolvedValue(null) },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(none, undefined, "auto")).toBe("auto");
    const junk = {
      preferences: {
        readToolPermissionMode: vi.fn().mockResolvedValue("yolo"),
      },
    } as unknown as StorageAdapter;
    expect(await readToolPermissionMode(junk)).toBe("ask");
    expect(await readToolPermissionMode(junk, undefined, "auto")).toBe("auto");
  });
});
