// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { ContextFolder } from "../../../../core/storage";

// End-to-end through the real `DropdownMenu`: the cloud rows must walk the
// host's hierarchy one level at a time — root (clouds) → rooms — and a room
// click has to land in the store. The unit test only inspects the item
// tree; this one drives the menu the way drill-down navigation does.

const mockFetchContextFolders = vi.fn();
const mockSelectContextFolder = vi.fn();

let mockContextFolders: ContextFolder[] = [];

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useCloudsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        contextFolders: mockContextFolders,
        fetchContextFolders: mockFetchContextFolders,
        selectedContextFolder: null,
        selectContextFolder: mockSelectContextFolder,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <span
      data-testid={
        (props["data-testid"] as string) ?? `icon-btn-${props.iconName}`
      }
    >
      {props.iconName as string}
    </span>
  ),
}));

vi.mock("../../../components/tooltip-icon-button", () => ({
  TooltipIconButton: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Force the menu open in drill-down mode: Radix opens on pointer events jsdom
// does not model, and the navigation mode normally comes from widget config.
vi.mock("../../../components/dropdown", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../components/dropdown")>();
  const Forced = (props: ComponentProps<typeof actual.DropdownMenu>) => (
    <actual.DropdownMenu {...props} open navigation="drilldown" />
  );
  return { ...actual, DropdownMenu: Forced };
});

// Rows expose a drill button so descending does not depend on Radix's
// pointer-driven selection; leaves expose a click button.
vi.mock("../../../components/dropdown-item", () => ({
  DropDownItem: ({
    text,
    subMenu,
    onDrill,
    onClick,
    isSeparator,
  }: {
    text: string;
    subMenu?: unknown[];
    onDrill?: () => void;
    onClick?: (e: Event) => void;
    isSeparator?: boolean;
  }) =>
    isSeparator ? (
      <hr data-testid="separator" />
    ) : (
      <div data-testid="row">
        <span>{text}</span>
        {subMenu && subMenu.length ? (
          <button data-testid={`drill-${text}`} onClick={onDrill}>
            drill
          </button>
        ) : (
          <button
            data-testid={`click-${text}`}
            onClick={() => onClick?.(new Event("click"))}
          >
            click
          </button>
        )}
      </div>
    ),
}));

import { ComposerActionSettings } from "../sub-components/ComposerActionSettings";

const rowTexts = () =>
  screen.getAllByTestId("row").map((r) => r.querySelector("span")?.textContent);

describe("ComposerActionSettings drill-down", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextFolders = [
      {
        cloud: "a.example.com",
        rooms: [
          { id: "r1", name: "Room 1" },
          { id: "r2", name: "Room 2" },
        ],
      },
      { cloud: "b.example.com", rooms: [{ id: "r3", name: "Room 3" }] },
    ];
  });

  it("lists the clouds at the root and nothing else", () => {
    render(<ComposerActionSettings />);
    expect(rowTexts()).toEqual(["a.example.com", "b.example.com"]);
    expect(screen.queryByTestId("separator")).toBeNull();
    expect(screen.queryByText("Room 1")).not.toBeInTheDocument();
  });

  it("descends into one cloud's rooms", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-a.example.com"));
    expect(rowTexts()).toEqual(["Room 1", "Room 2"]);
    expect(screen.queryByText("Room 3")).not.toBeInTheDocument();
  });

  it("a room click stores the room with its cloud", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-b.example.com"));
    fireEvent.click(screen.getByTestId("click-Room 3"));
    expect(mockSelectContextFolder).toHaveBeenCalledWith("b.example.com", {
      id: "r3",
      name: "Room 3",
    });
  });

  it("walks back up to the root with ArrowLeft", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-a.example.com"));
    const content = screen
      .getByText("Room 1")
      .closest("[data-orientation='vertical']");
    expect(content).not.toBeNull();
    fireEvent.keyDown(content as Element, { key: "ArrowLeft" });
    expect(rowTexts()).toEqual(["a.example.com", "b.example.com"]);
  });

  it("renders nothing without clouds", () => {
    mockContextFolders = [];
    const { container } = render(<ComposerActionSettings />);
    expect(container).toBeEmptyDOMElement();
  });
});
