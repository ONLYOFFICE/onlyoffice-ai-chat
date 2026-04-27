// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelCardShell } from "../sub-components/ModelCardShell";

describe("ModelCardShell", () => {
  it("renders children", () => {
    render(
      <ModelCardShell>
        <span data-testid="child">Hello</span>
      </ModelCardShell>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });

  it("renders a wrapper div", () => {
    const { container } = render(
      <ModelCardShell>
        <span>Content</span>
      </ModelCardShell>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
  });

  it("applies expected class names", () => {
    const { container } = render(
      <ModelCardShell>
        <span>Content</span>
      </ModelCardShell>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("w-full");
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("flex-col");
  });

  it("renders multiple children", () => {
    render(
      <ModelCardShell>
        <span data-testid="a">A</span>
        <span data-testid="b">B</span>
      </ModelCardShell>
    );
    expect(screen.getByTestId("a")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });
});
