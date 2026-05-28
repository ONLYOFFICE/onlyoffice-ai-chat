import { describe, expect, it } from "vitest";
import type { Prompt, PromptFolder } from "../../../types";
import {
  validateFolderName,
  validateFolderReference,
  validatePromptName,
} from "../validation";

const folder = (id: string, name: string): PromptFolder => ({
  id,
  name,
  createdAt: 1,
  updatedAt: 1,
});

const prompt = (
  id: string,
  name: string,
  folderId?: string | null
): Prompt => ({
  id,
  name,
  text: "",
  folderId: folderId ?? undefined,
  createdAt: 1,
  updatedAt: 1,
});

describe("validateFolderName", () => {
  it("rejects empty / whitespace names", () => {
    expect(validateFolderName([], "")?.message).toBe("Name is required");
    expect(validateFolderName([], "   ")?.message).toBe("Name is required");
  });

  it("rejects duplicates (case-insensitive)", () => {
    expect(validateFolderName([folder("a", "Inbox")], "INBOX")?.message).toBe(
      "Folder name already exists"
    );
  });

  it("excludes a folder id during rename", () => {
    expect(validateFolderName([folder("a", "Inbox")], "INBOX", "a")).toBeNull();
  });

  it("returns null when name is unique and non-empty", () => {
    expect(validateFolderName([folder("a", "Inbox")], "Other")).toBeNull();
  });
});

describe("validatePromptName", () => {
  it("rejects empty / whitespace names", () => {
    expect(validatePromptName([], "", null)?.message).toBe("Name is required");
    expect(validatePromptName([], "  ", null)?.message).toBe(
      "Name is required"
    );
  });

  it("treats folderId null and undefined as the same root scope", () => {
    expect(
      validatePromptName([prompt("a", "Foo", null)], "FOO", undefined)?.message
    ).toBe("Prompt name already exists in this folder");
  });

  it("scopes name uniqueness per folder — same name across folders is allowed", () => {
    expect(
      validatePromptName([prompt("a", "Foo", "folder1")], "Foo", "folder2")
    ).toBeNull();
  });

  it("excludes a prompt id during rename", () => {
    expect(
      validatePromptName([prompt("a", "Foo", "f1")], "Foo", "f1", "a")
    ).toBeNull();
  });
});

describe("validateFolderReference", () => {
  it("returns null when no folder id supplied", () => {
    expect(validateFolderReference([], null)).toBeNull();
    expect(validateFolderReference([], undefined)).toBeNull();
  });

  it("returns null when reference resolves", () => {
    expect(validateFolderReference([folder("f1", "F")], "f1")).toBeNull();
  });

  it("flags missing references", () => {
    expect(
      validateFolderReference([folder("f1", "F")], "missing")?.message
    ).toBe("Folder not found: missing");
  });
});
