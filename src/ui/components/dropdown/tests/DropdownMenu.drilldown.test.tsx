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

  it("labels the back row with the parent and drops its separator on request", () => {
    renderMenu({ backRowLabel: true });
    fireEvent.click(screen.getByTestId("drill-Folder"));
    const back = screen.getByTestId("dropdown-back-row");
    expect(back.textContent).toContain("Folder");
    expect(
      back.querySelector("[data-testid='icon-btn-arrow.right']")
    ).not.toBeNull();
    expect(screen.queryByTestId("dropdown-back-separator")).toBeNull();
    // Selecting the labelled row goes back up.
    fireEvent.click(back);
    expect(screen.getByText("Leaf")).toBeInTheDocument();
  });

  it("keeps the bare chevron and its separator by default", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.queryByTestId("dropdown-back-row")).toBeNull();
    expect(screen.getByTestId("dropdown-back-separator")).toBeInTheDocument();
  });

  it("keeps the header at the root only when asked, on every level otherwise", () => {
    const { unmount } = renderMenu({
      headerContent: <div data-testid="hdr" />,
      headerAtRootOnly: true,
    });
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.queryByTestId("hdr")).toBeNull();
    unmount();
    renderMenu({ headerContent: <div data-testid="hdr" /> });
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
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

  it("resets to the root level when a controlled close happens outside Radix", () => {
    // ComposerActionPrompts closes the menu by flipping the controlled `open`
    // prop from a leaf action; Radix never calls onOpenChange for that, so the
    // reset has to hang off the actual close.
    const { rerender } = renderMenu();
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.getByText("ChildLeaf")).toBeInTheDocument();

    const at = (open: boolean) => (
      <DropdownMenu
        trigger={<button>Trigger</button>}
        navigation="drilldown"
        items={makeTree()}
        open={open}
      />
    );
    rerender(at(false));
    rerender(at(true));

    expect(screen.getByText("Leaf")).toBeInTheDocument();
    expect(screen.queryByText("ChildLeaf")).not.toBeInTheDocument();
  });

  // Rows carrying an `id` are addressed by it, so a level rebuilt with rows
  // added or removed around the current one keeps pointing at the same row —
  // moving a prompt into a folder shifts every index after it at the root.
  const withIds = (rows: string[]): DropDownItemProps[] =>
    rows.map((id) => ({
      id,
      text: id,
      onClick: vi.fn(),
      subMenu: [{ text: `${id}-child`, onClick: vi.fn() }],
    }));

  it("follows the same row by id when items are rebuilt around it", () => {
    const { rerender } = render(
      <DropdownMenu
        trigger={<button>Trigger</button>}
        navigation="drilldown"
        items={withIds(["p1", "p2"])}
        open
      />
    );
    fireEvent.click(screen.getByTestId("drill-p2"));
    expect(screen.getByText("p2-child")).toBeInTheDocument();

    // p1 leaves the level (moved into a folder): p2 slides from index 1 to 0.
    rerender(
      <DropdownMenu
        trigger={<button>Trigger</button>}
        navigation="drilldown"
        items={withIds(["p2"])}
        open
      />
    );
    expect(screen.getByText("p2-child")).toBeInTheDocument();
  });

  // When a rebuild does invalidate the tail, the visible level is the deepest
  // valid one — navigation has to move relative to that, not to the raw stack,
  // or the first back/drill press is swallowed re-truncating the same tail.
  const deepThenFlat = (deep: boolean): DropDownItemProps[] => [
    {
      text: "Folder",
      onClick: vi.fn(),
      subMenu: [
        { text: "ChildLeaf", onClick: vi.fn() },
        ...(deep
          ? [
              {
                text: "SubFolder",
                onClick: vi.fn(),
                subMenu: [{ text: "DeepLeaf", onClick: vi.fn() }],
              },
            ]
          : []),
      ],
    },
    { text: "Leaf", onClick: vi.fn() },
  ];

  const renderInvalidatedTail = () => {
    const { rerender } = render(
      <DropdownMenu
        trigger={<button>Trigger</button>}
        navigation="drilldown"
        items={deepThenFlat(true)}
        open
      />
    );
    fireEvent.click(screen.getByTestId("drill-Folder"));
    fireEvent.click(screen.getByTestId("drill-SubFolder"));
    expect(screen.getByText("DeepLeaf")).toBeInTheDocument();
    // SubFolder disappears: the stack's last step no longer resolves.
    rerender(
      <DropdownMenu
        trigger={<button>Trigger</button>}
        navigation="drilldown"
        items={deepThenFlat(false)}
        open
      />
    );
    expect(screen.getByText("ChildLeaf")).toBeInTheDocument();
  };

  it("goes back to the root in one press after the tail was invalidated", () => {
    renderInvalidatedTail();
    fireEvent.keyDown(
      screen.getByText("ChildLeaf").closest("[data-orientation='vertical']")!,
      { key: "ArrowLeft" }
    );
    expect(screen.getByText("Leaf")).toBeInTheDocument();
    expect(screen.queryByText("ChildLeaf")).not.toBeInTheDocument();
  });

  it("still drills after the tail was invalidated", () => {
    renderInvalidatedTail();
    fireEvent.keyDown(
      screen.getByText("ChildLeaf").closest("[data-orientation='vertical']")!,
      { key: "ArrowLeft" }
    );
    fireEvent.click(screen.getByTestId("drill-Folder"));
    expect(screen.getByText("ChildLeaf")).toBeInTheDocument();
    expect(screen.queryByText("Leaf")).not.toBeInTheDocument();
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

  describe("footerItems", () => {
    const footer: DropDownItemProps[] = [
      { text: "", onClick: vi.fn(), isSeparator: true },
      {
        text: "Effort",
        onClick: vi.fn(),
        subMenu: [
          { text: "Low", onClick: vi.fn() },
          { text: "High", onClick: vi.fn() },
        ],
      },
    ];

    it("shows the footer on the root level only", () => {
      renderMenu({ footerItems: footer });
      expect(screen.getByTestId("dropdown-footer")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("drill-Folder"));
      expect(screen.queryByTestId("dropdown-footer")).toBeNull();
      expect(screen.queryByText("Effort")).not.toBeInTheDocument();
      expect(screen.getByText("ChildLeaf")).toBeInTheDocument();
    });

    it("drills into a footer row like any other row", () => {
      renderMenu({ footerItems: footer });
      fireEvent.click(screen.getByTestId("drill-Effort"));
      expect(screen.getByText("Low")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.queryByText("Leaf")).not.toBeInTheDocument();
    });

    it("comes back to the root with the footer in place", () => {
      renderMenu({ footerItems: footer });
      fireEvent.click(screen.getByTestId("drill-Effort"));
      const content = screen
        .getByText("Low")
        .closest("[data-orientation='vertical']");
      fireEvent.keyDown(content as Element, { key: "ArrowLeft" });
      expect(screen.getByTestId("dropdown-footer")).toContainElement(
        screen.getByText("Effort")
      );
      expect(screen.getByText("Leaf")).toBeInTheDocument();
    });
  });
});
