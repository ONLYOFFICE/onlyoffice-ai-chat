// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({
    iconName,
    onClick,
  }: {
    iconName: string;
    onClick?: () => void;
  }) => (
    <button data-testid={`icon-btn-${iconName}`} onClick={onClick}>
      {iconName}
    </button>
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

import { DropdownMenu } from "../index";

describe("DropdownMenu", () => {
  it("renders trigger", () => {
    render(
      <DropdownMenu
        trigger={<button>Open Menu</button>}
        items={[{ text: "Item 1", onClick: vi.fn() }]}
      />
    );
    expect(screen.getByText("Open Menu")).toBeInTheDocument();
  });

  it("shows items when opened", () => {
    render(
      <DropdownMenu
        trigger={<button>Open</button>}
        items={[
          { text: "Edit", onClick: vi.fn() },
          { text: "Delete", onClick: vi.fn() },
        ]}
        open={true}
      />
    );
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders separator items", () => {
    render(
      <DropdownMenu
        trigger={<button>Open</button>}
        items={[
          { text: "A", onClick: vi.fn() },
          { text: "", onClick: vi.fn(), isSeparator: true },
          { text: "B", onClick: vi.fn() },
        ]}
        open={true}
      />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("passes onOpenChange prop", () => {
    const onOpenChange = vi.fn();
    // Just verify it renders without error with onOpenChange
    expect(() =>
      render(
        <DropdownMenu
          trigger={<button>Open</button>}
          items={[{ text: "Item", onClick: vi.fn() }]}
          onOpenChange={onOpenChange}
        />
      )
    ).not.toThrow();
  });
});
