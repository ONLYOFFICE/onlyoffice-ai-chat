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

vi.mock("../../../hooks/useReasoningSupport", () => ({
  useReasoningSupport: () => ({ thinks: false, canDisable: false, depths: [] }),
}));

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        changeToolStatus: vi.fn(),
        webSearchEnabled: false,
        disabledTools: {},
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    useProfilesStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { reasoningLevel: "off", setReasoningLevel: vi.fn() };
      return typeof selector === "function" ? selector(state) : state;
    },
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

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => ({ eventBus: { emit: vi.fn() } }),
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

vi.mock("../sub-components/ConnectRoomDialog", () => ({
  ConnectRoomDialog: ({
    cloud,
    room,
    onConfirm,
    onClose,
  }: {
    cloud: string;
    room: { id: string; name: string };
    onConfirm: () => void;
    onClose: () => void;
  }) => (
    <div
      data-testid="connect-room-dialog"
      data-cloud={cloud}
      data-room={room.id}
    >
      <button
        data-testid="connect-room-confirm"
        onClick={() => {
          onConfirm();
          onClose();
        }}
      >
        connect
      </button>
    </div>
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

  it("lists the clouds at the root, above the switches", () => {
    render(<ComposerActionSettings />);
    expect(rowTexts()).toEqual(["a.example.com", "b.example.com", "WebSearch"]);
    expect(screen.getByTestId("separator")).toBeInTheDocument();
    expect(screen.queryByText("Room 1")).not.toBeInTheDocument();
  });

  it("descends into one cloud's rooms", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-a.example.com"));
    expect(rowTexts()).toEqual(["Room 1", "Room 2"]);
    expect(screen.queryByText("WebSearch")).not.toBeInTheDocument();
    expect(screen.queryByText("Room 3")).not.toBeInTheDocument();
  });

  it("a room click opens the confirmation for that room and cloud", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-b.example.com"));
    fireEvent.click(screen.getByTestId("click-Room 3"));
    const dialog = screen.getByTestId("connect-room-dialog");
    expect(dialog.getAttribute("data-cloud")).toBe("b.example.com");
    expect(dialog.getAttribute("data-room")).toBe("r3");
    expect(mockSelectContextFolder).not.toHaveBeenCalled();
  });

  it("confirming stores the room with its cloud", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-b.example.com"));
    fireEvent.click(screen.getByTestId("click-Room 3"));
    fireEvent.click(screen.getByTestId("connect-room-confirm"));
    expect(mockSelectContextFolder).toHaveBeenCalledWith("b.example.com", {
      id: "r3",
      name: "Room 3",
    });
    expect(screen.queryByTestId("connect-room-dialog")).toBeNull();
  });

  it("walks back up to the root with ArrowLeft", () => {
    render(<ComposerActionSettings />);
    fireEvent.click(screen.getByTestId("drill-a.example.com"));
    const content = screen
      .getByText("Room 1")
      .closest("[data-orientation='vertical']");
    expect(content).not.toBeNull();
    fireEvent.keyDown(content as Element, { key: "ArrowLeft" });
    expect(rowTexts()).toEqual(["a.example.com", "b.example.com", "WebSearch"]);
  });

  it("has no cloud rows at all without clouds", () => {
    mockContextFolders = [];
    render(<ComposerActionSettings />);
    expect(rowTexts()).toEqual(["WebSearch"]);
    expect(screen.queryByTestId("separator")).not.toBeInTheDocument();
  });
});
