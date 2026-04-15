// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Link } from "../index";

describe("Link", () => {
  it("renders an anchor element with children", () => {
    render(<Link href="/test">Go</Link>);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Go");
    expect(link).toHaveAttribute("href", "/test");
  });

  it("applies underline class", () => {
    render(<Link href="#">Link</Link>);
    expect(screen.getByRole("link")).toHaveClass("underline");
  });

  it("applies custom className", () => {
    render(
      <Link href="#" className="my-link">
        Link
      </Link>
    );
    expect(screen.getByRole("link")).toHaveClass("my-link");
  });

  it("passes through additional props", () => {
    render(
      <Link href="#" target="_blank" rel="noopener">
        Ext
      </Link>
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });
});
