// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <span data-testid="tooltip-content" className={className}>
      {children}
    </span>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { vi } from "vitest";
import { TooltipIconButton } from "../index";

describe("TooltipIconButton", () => {
  it("renders children", () => {
    render(
      <TooltipIconButton tooltip="Click me">
        <button>Icon</button>
      </TooltipIconButton>
    );
    expect(screen.getByText("Icon")).toBeInTheDocument();
  });

  it("renders tooltip text", () => {
    render(
      <TooltipIconButton tooltip="Help text">
        <button>Btn</button>
      </TooltipIconButton>
    );
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent(
      "Help text"
    );
  });

  it("hides tooltip when visible is false", () => {
    render(
      <TooltipIconButton tooltip="Hidden" visible={false}>
        <button>Btn</button>
      </TooltipIconButton>
    );
    expect(screen.getByTestId("tooltip-content")).toHaveClass("hidden");
  });

  it("shows tooltip when visible is true (default)", () => {
    render(
      <TooltipIconButton tooltip="Shown">
        <button>Btn</button>
      </TooltipIconButton>
    );
    expect(screen.getByTestId("tooltip-content")).not.toHaveClass("hidden");
  });

  it("applies custom className", () => {
    const { container } = render(
      <TooltipIconButton tooltip="T" className="my-class">
        <button>B</button>
      </TooltipIconButton>
    );
    // The wrapper div should have the class
    const wrapper = container.querySelector(".my-class");
    expect(wrapper).toBeInTheDocument();
  });
});
