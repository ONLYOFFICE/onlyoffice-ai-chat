// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../../hooks/useDirection", () => ({
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

  it("reserves the icon column for icon-less rows in a mixed menu", () => {
    render(
      <DropdownMenu
        trigger={<button>Trigger</button>}
        items={[
          { text: "Open", onClick: vi.fn() },
          { text: "Save", icon: "btn-save", onClick: vi.fn() },
        ]}
        open={true}
      />
    );
    // Icon-less row gets the reserved-space indent; the icon row does not.
    expect(screen.getByText("Open").className).toContain(
      "ms-[var(--dropdown-item-label-space,28px)]"
    );
    expect(screen.getByText("Save").className).not.toContain(
      "ms-[var(--dropdown-item-label-space,28px)]"
    );
  });

  it("does not indent rows when no item has an icon", () => {
    render(
      <DropdownMenu
        trigger={<button>Open</button>}
        items={[
          { text: "First", onClick: vi.fn() },
          { text: "Second", onClick: vi.fn() },
        ]}
        open={true}
      />
    );
    expect(screen.getByText("First").className).not.toContain(
      "ms-[var(--dropdown-item-label-space,28px)]"
    );
    expect(screen.getByText("Second").className).not.toContain(
      "ms-[var(--dropdown-item-label-space,28px)]"
    );
  });

  it("honors an explicit withSpace override over auto-detection", () => {
    render(
      <DropdownMenu
        trigger={<button>Open</button>}
        items={[
          { text: "NoIcons", withSpace: true, onClick: vi.fn() },
          { text: "Other", onClick: vi.fn() },
        ]}
        open={true}
      />
    );
    // No item has an icon, but the explicit flag still applies.
    expect(screen.getByText("NoIcons").className).toContain(
      "ms-[var(--dropdown-item-label-space,28px)]"
    );
    expect(screen.getByText("Other").className).not.toContain(
      "ms-[var(--dropdown-item-label-space,28px)]"
    );
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

  describe("footerItems", () => {
    const items = [
      { text: "Profile 1", onClick: vi.fn() },
      { text: "Profile 2", onClick: vi.fn() },
    ];
    const footer = [
      { text: "", onClick: vi.fn(), isSeparator: true },
      { text: "Effort", onClick: vi.fn() },
    ];

    it("renders the list in a scroll area and the footer pinned outside it", () => {
      render(
        <DropdownMenu
          trigger={<button>Open</button>}
          items={items}
          footerItems={footer}
          open
        />
      );
      const scroll = screen.getByTestId("dropdown-scroll-area");
      const pinned = screen.getByTestId("dropdown-footer");
      expect(scroll).toContainElement(screen.getByText("Profile 1"));
      expect(scroll).toContainElement(screen.getByText("Profile 2"));
      expect(pinned).toContainElement(screen.getByText("Effort"));
      expect(scroll).not.toContainElement(screen.getByText("Effort"));
      // The list scrolls, the footer does not.
      expect(scroll.className).toContain("overflow-y-auto");
      expect(pinned.className).toContain("shrink-0");
    });

    it("moves scrolling off the content so the footer cannot scroll away", () => {
      render(
        <DropdownMenu
          trigger={<button>Open</button>}
          items={items}
          footerItems={footer}
          open
        />
      );
      const content = document.querySelector(".dropdown-menu") as HTMLElement;
      expect(content.className).toContain("overflow-hidden");
      expect(content.className).not.toContain("overflow-y-auto");
    });

    it("does not indent the list for an icon that only the footer has", () => {
      render(
        <DropdownMenu
          trigger={<button>Open</button>}
          items={items}
          footerItems={[
            { text: "", onClick: vi.fn(), isSeparator: true },
            {
              text: "Effort",
              icon: <span data-testid="effort-icon" />,
              onClick: vi.fn(),
            },
            { text: "Plain footer", onClick: vi.fn() },
          ]}
          open={true}
        />
      );
      // The profiles above the footer keep their labels at the start...
      expect(screen.getByText("Profile 1").className).not.toContain(
        "ms-[var(--dropdown-item-label-space,28px)]"
      );
      // ...while an icon-less footer row lines up with the footer's icon.
      expect(screen.getByText("Plain footer").className).toContain(
        "ms-[var(--dropdown-item-label-space,28px)]"
      );
    });

    it("keeps the content scrolling itself without a footer", () => {
      render(
        <DropdownMenu trigger={<button>Open</button>} items={items} open />
      );
      const content = document.querySelector(".dropdown-menu") as HTMLElement;
      expect(content.className).toContain("overflow-y-auto");
      expect(screen.queryByTestId("dropdown-footer")).toBeNull();
      expect(screen.queryByTestId("dropdown-scroll-area")).toBeNull();
    });

    it("treats an empty footer like no footer", () => {
      render(
        <DropdownMenu
          trigger={<button>Open</button>}
          items={items}
          footerItems={[]}
          open
        />
      );
      expect(screen.queryByTestId("dropdown-footer")).toBeNull();
    });
  });
});
