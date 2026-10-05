import { describe, expect, it } from "vitest";
import { markdownUrlTransform } from "../url-transform";

describe("markdownUrlTransform", () => {
  it("keeps web, mail and relative targets", () => {
    expect(markdownUrlTransform("https://example.com/a?b=c:d")).toBe(
      "https://example.com/a?b=c:d"
    );
    expect(markdownUrlTransform("mailto:me@example.com")).toBe(
      "mailto:me@example.com"
    );
    expect(markdownUrlTransform("/Users/me/report.docx")).toBe(
      "/Users/me/report.docx"
    );
    expect(markdownUrlTransform("#anchor")).toBe("#anchor");
  });

  it("keeps file: targets", () => {
    expect(markdownUrlTransform("file:///C:/Users/me/report.docx")).toBe(
      "file:///C:/Users/me/report.docx"
    );
    expect(markdownUrlTransform("FILE:///home/me/report.docx")).toBe(
      "FILE:///home/me/report.docx"
    );
  });

  it("blanks every other scheme", () => {
    expect(markdownUrlTransform("sandbox:/C:/Users/me/report.docx")).toBe("");
    expect(markdownUrlTransform("C:/Users/me/report.docx")).toBe("");
    expect(markdownUrlTransform("javascript:alert(1)")).toBe("");
  });
});
