// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({ iconName }: { iconName: string }) => (
    <span data-testid={`icon-btn-${iconName}`}>{iconName}</span>
  ),
}));

// Mock DropDownItem so onDrill can be invoked deterministically without driving
// Radix's pointer-based selection. Each row with a submenu exposes a drill
// button; the navigation mode is reflected via data-nav.
vi.mock("../../dropdown-item", () => ({
  DropDownItem: ({
    text,
    subMenu,
    onDrill,
    navigation,
  }: {
    text: string;
    subMenu?: unknown[];
    onDrill?: () => void;
    navigation?: string;
  }) => (
    <div data-testid="row" data-nav={navigation}>
      <span>{text}</span>
      {subMenu && subMenu.length ? (
        <button data-testid={`drill-${text}`} onClick={onDrill}>
          drill
        </button>
      ) : null}
    </div>
  ),
}));

import { DropdownMenu } from "../index";
import type { DropDownItemProps } from "../../dropdown-item/DropDownItem.types";

const makeTree = (): DropDownItemProps[] => [
  { text: "Leaf", onClick: vi.fn() },
  {
    text: "Folder",
    onClick: vi.fn(),
    subMenu: [
      { text: "ChildLeaf", onClick: vi.fn() },
      {
        text: "SubFolder",
        onClick: vi.fn(),
        subMenu: [{ text: "DeepLeaf", onClick: vi.fn() }],
      },
    ],
  },
];

const renderMenu = (
  props: Partial<React.ComponentProps<typeof DropdownMenu>> = {}
) =>
  render(
    <DropdownMenu
      trigger={<button>Trigger</button>}
      navigation="drilldown"
      items={makeTree()}
      open
      {...props}
    />
  );

describe("DropdownMenu drill-down", () => {
  it("renders the root level with no back row and navigation=drilldown", () => {
    renderMenu();
    expect(screen.getByText("Leaf")).toBeInTheDocument();
    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(screen.queryByText("ChildLeaf")).not.toBeInTheDocument();
    // Back chevron only appears once we descend a level.
    expect(
      screen.queryByTestId("icon-btn-arrow.right")
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("row")[0].getAttribute("data-nav")).toBe(
      "drilldown"
    );
  });

  it("drills into a folder, showing the child level and a back row", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.getByText("ChildLeaf")).toBeInTheDocument();
    expect(screen.queryByText("Leaf")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon-btn-arrow.right")).toBeInTheDocument();
  });

  it("goes back a level via ArrowLeft", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    const content = screen
      .getByText("ChildLeaf")
      .closest("[data-orientation='vertical']");
    expect(content).not.toBeNull();
    fireEvent.keyDown(content as Element, { key: "ArrowLeft" });
    expect(screen.getByText("Leaf")).toBeInTheDocument();
    expect(screen.queryByText("ChildLeaf")).not.toBeInTheDocument();
  });

  it("supports depth greater than two levels", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    fireEvent.click(screen.getByTestId("drill-SubFolder"));
    expect(screen.getByText("DeepLeaf")).toBeInTheDocument();
  });

  it("re-resolves the level against rebuilt items, keeping the current depth", () => {
    const { rerender } = renderMenu();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.getByText("ChildLeaf")).toBeInTheDocument();
    // External rebuild: brand-new item objects, same structure (mimics a tool
    // toggle inside a submenu rebuilding the whole tree).
    rerender(
      <DropdownMenu
        trigger={<button>Trigger</button>}
        navigation="drilldown"
        items={makeTree()}
        open
      />
    );
    expect(screen.getByText("ChildLeaf")).toBeInTheDocument();
    expect(screen.queryByText("Leaf")).not.toBeInTheDocument();
  });

  it("does not break on duplicate row names without ids", () => {
    const dupes: DropDownItemProps[] = [
      { text: "New folder", onClick: vi.fn() },
      { text: "New folder", onClick: vi.fn() },
    ];
    expect(() =>
      render(
        <DropdownMenu
          trigger={<button>Trigger</button>}
          navigation="drilldown"
          items={dupes}
          open
        />
      )
    ).not.toThrow();
    expect(screen.getAllByText("New folder")).toHaveLength(2);
  });

  it("raises the height cap only while inside a row that asks for it", () => {
    const items = makeTree();
    items[1].subMenuMaxHeight = "40rem";
    renderMenu({ items });
    const content = () =>
      document.querySelector(".dropdown-menu") as HTMLElement;
    expect(content().style.maxHeight).toContain("14rem");
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(content().style.maxHeight).toBe("40rem");
    // The deeper level has no cap of its own: back to the default.
    fireEvent.click(screen.getByTestId("drill-SubFolder"));
    expect(content().style.maxHeight).toContain("14rem");
  });

  it("flyout mode renders all items flat with navigation=flyout and no back row", () => {
    renderMenu({ navigation: "flyout" });
    expect(screen.getByText("Leaf")).toBeInTheDocument();
    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(
      screen.queryByTestId("icon-btn-arrow.right")
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("row")[0].getAttribute("data-nav")).toBe(
      "flyout"
    );
  });
});
