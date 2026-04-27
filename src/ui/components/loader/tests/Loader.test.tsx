// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Loader } from "../index";

describe("Loader", () => {
  it("renders with default size", () => {
    const { container } = render(<Loader />);
    const div = container.firstElementChild as HTMLElement;
    expect(div.style.width).toBe("16px");
    expect(div.style.height).toBe("16px");
  });

  it("renders with custom size", () => {
    const { container } = render(<Loader size={32} />);
    const div = container.firstElementChild as HTMLElement;
    expect(div.style.width).toBe("32px");
    expect(div.style.height).toBe("32px");
  });

  it("applies custom className", () => {
    const { container } = render(<Loader className="extra" />);
    expect(container.firstElementChild).toHaveClass("extra");
  });

  it("has spinning animation class", () => {
    const { container } = render(<Loader />);
    expect(container.firstElementChild).toHaveClass("animate-spin");
  });
});
