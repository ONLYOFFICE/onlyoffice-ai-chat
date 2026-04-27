// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid="icon" className={className}>
      {name}
    </span>
  ),
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({ iconName }: { iconName: string }) => (
    <button data-testid={`icon-btn-${iconName}`}>{iconName}</button>
  ),
}));

vi.mock("../../toggle-button", () => ({
  ToggleButton: () => <div data-testid="toggle" />,
}));

vi.mock("../../tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock DropdownMenu that invokes onOpenChange to exercise the isOpen state
vi.mock("../../dropdown", () => ({
  DropdownMenu: ({
    trigger,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    onOpenChange?: (value: boolean) => void;
  }) => (
    <div data-testid="dropdown-menu">
      <div
        data-testid="dropdown-trigger-wrapper"
        onClick={() => onOpenChange?.(true)}
      >
        {trigger}
      </div>
    </div>
  ),
}));

import { ComboBox } from "../index";

describe("ComboBox", () => {
  it("renders placeholder when no value", () => {
    render(
      <ComboBox
        placeholder="Select..."
        items={[{ text: "Option 1", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByText("Select...")).toBeInTheDocument();
  });

  it("renders value when provided", () => {
    render(
      <ComboBox
        value="Option 1"
        items={[{ text: "Option 1", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByText("Option 1")).toBeInTheDocument();
  });

  it("renders arrow icon", () => {
    render(<ComboBox items={[{ text: "A", onClick: vi.fn() }]} />);
    expect(screen.getByTestId("icon")).toHaveTextContent("arrow.bottom.big");
  });

  it("applies data-testid", () => {
    render(
      <ComboBox
        data-testid="my-combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByTestId("my-combo")).toBeInTheDocument();
  });

  it("applies disabled styles when disabled", () => {
    render(
      <ComboBox
        disabled
        data-testid="combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByTestId("combo")).toHaveClass("cursor-not-allowed");
  });

  it("applies disabled styles when items is empty", () => {
    render(<ComboBox data-testid="combo" items={[]} />);
    expect(screen.getByTestId("combo")).toHaveClass("cursor-not-allowed");
  });

  it("applies error border via inline style when isError is true", () => {
    render(
      <ComboBox
        isError
        data-testid="combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    const trigger = screen.getByTestId("combo");
    expect(trigger.style.borderColor).toBe("var(--border-error)");
  });

  it("does not apply error border when isError is false", () => {
    render(
      <ComboBox data-testid="combo" items={[{ text: "A", onClick: vi.fn() }]} />
    );
    const trigger = screen.getByTestId("combo");
    expect(trigger.style.borderColor).toBe("");
  });

  it("applies custom className", () => {
    render(
      <ComboBox
        className="custom-class"
        data-testid="combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByTestId("combo")).toHaveClass("custom-class");
  });

  it("renders placeholder text in placeholder color when no value", () => {
    render(
      <ComboBox
        placeholder="Pick one"
        data-testid="combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    const span = screen.getByText("Pick one");
    expect(span.className).toContain("placeholder");
  });

  it("renders value text in normal color when value provided", () => {
    render(
      <ComboBox
        value="Hello"
        data-testid="combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    const span = screen.getByText("Hello");
    expect(span.className).toContain("input-color");
  });

  it("applies open state styles when dropdown is opened", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <ComboBox data-testid="combo" items={[{ text: "A", onClick: vi.fn() }]} />
    );
    // Click the trigger wrapper to invoke onOpenChange(true)
    fireEvent.click(screen.getByTestId("dropdown-trigger-wrapper"));
    // After opening, the combo should have the active border class
    const combo = screen.getByTestId("combo");
    expect(combo).toHaveClass("border");
  });

  it("applies pointer-events-none and opacity-50 when disabled", () => {
    render(
      <ComboBox
        disabled
        data-testid="combo"
        items={[{ text: "A", onClick: vi.fn() }]}
      />
    );
    const combo = screen.getByTestId("combo");
    expect(combo).toHaveClass("pointer-events-none");
    expect(combo).toHaveClass("opacity-50");
  });
});
