// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { FieldContainer } from "../index";

describe("FieldContainer", () => {
  it("renders header text", () => {
    render(
      <FieldContainer header="Name">
        <input />
      </FieldContainer>
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <FieldContainer header="Field">
        <input placeholder="test" />
      </FieldContainer>
    );
    expect(screen.getByPlaceholderText("test")).toBeInTheDocument();
  });

  it("renders icon when icon prop is provided", () => {
    render(
      <FieldContainer header="With Icon" icon="settings">
        <input />
      </FieldContainer>
    );
    expect(screen.getByTestId("icon")).toHaveTextContent("settings");
  });

  it("renders error message", () => {
    render(
      <FieldContainer header="Field" error="Required field">
        <input />
      </FieldContainer>
    );
    // Error text appears in both the visible text and the tooltip
    const errors = screen.getAllByText("Required field");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render error block when no error", () => {
    const { container } = render(
      <FieldContainer header="Field">
        <input />
      </FieldContainer>
    );
    expect(
      container.querySelector(
        ".text-\\[var\\(--field-container-error-color\\)\\]"
      )
    ).toBeNull();
  });

  it("renders action slot", () => {
    render(
      <FieldContainer header="Field" action={<button>Action</button>}>
        <input />
      </FieldContainer>
    );
    expect(screen.getByText("Action")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <FieldContainer header="Field" className="my-class">
        <input />
      </FieldContainer>
    );
    expect(container.firstElementChild).toHaveClass("my-class");
  });
});
