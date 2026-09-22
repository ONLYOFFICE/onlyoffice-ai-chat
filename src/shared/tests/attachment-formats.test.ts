import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_PICK_FILTERS,
  isSupportedAttachmentPath,
} from "../attachment-formats";

describe("ATTACHMENT_PICK_FILTERS", () => {
  it("offers no wildcard / all-files group", () => {
    // The whole point of the filter list: a host rendering it verbatim must
    // not end up with an "All files (*.*)" row.
    for (const filter of ATTACHMENT_PICK_FILTERS) {
      expect(filter.extensions.length).toBeGreaterThan(0);
      for (const ext of filter.extensions) {
        expect(ext).not.toContain("*");
        expect(ext).not.toContain(".");
        expect(ext).toBe(ext.toLowerCase());
      }
    }
  });

  it("gives every group a stable id and a label", () => {
    const ids = ATTACHMENT_PICK_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const filter of ATTACHMENT_PICK_FILTERS) {
      expect(filter.label).not.toBe("");
    }
  });

  it("lists no extension in two groups", () => {
    const all = ATTACHMENT_PICK_FILTERS.flatMap((f) => f.extensions);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("isSupportedAttachmentPath", () => {
  it("accepts the office formats the converter handles", () => {
    expect(isSupportedAttachmentPath("/docs/report.docx")).toBe(true);
    expect(isSupportedAttachmentPath("/docs/budget.xlsx")).toBe(true);
    expect(isSupportedAttachmentPath("/docs/deck.pptx")).toBe(true);
    expect(isSupportedAttachmentPath("/docs/scan.pdf")).toBe(true);
    expect(isSupportedAttachmentPath("/docs/notes.md")).toBe(true);
  });

  it("rejects formats that cannot become text", () => {
    expect(isSupportedAttachmentPath("/docs/setup.exe")).toBe(false);
    expect(isSupportedAttachmentPath("/docs/archive.zip")).toBe(false);
    expect(isSupportedAttachmentPath("/docs/clip.mp4")).toBe(false);
    // Images ride the separate <input accept="image/*"> path, not this one.
    expect(isSupportedAttachmentPath("/docs/photo.png")).toBe(false);
  });

  it("handles windows paths and mixed case", () => {
    expect(isSupportedAttachmentPath("C:\\Users\\me\\Report.DOCX")).toBe(true);
    expect(isSupportedAttachmentPath("C:\\Users\\me\\setup.EXE")).toBe(false);
  });

  it("rejects paths with no usable extension", () => {
    expect(isSupportedAttachmentPath("/docs/README")).toBe(false);
    expect(isSupportedAttachmentPath("")).toBe(false);
    // A dot in a directory name is not the file's extension.
    expect(isSupportedAttachmentPath("/my.docs/README")).toBe(false);
    // A dotfile's leading dot does not make it a "docx" either.
    expect(isSupportedAttachmentPath("/docs/.docx")).toBe(false);
  });
});
