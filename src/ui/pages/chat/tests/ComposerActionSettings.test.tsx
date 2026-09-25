// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ContextFolder } from "../../../../core/storage";

const mockFetchContextFolders = vi.fn();
const mockSelectContextFolder = vi.fn();

let mockContextFolders: ContextFolder[] = [];
let mockSelectedContextFolder: {
  cloud: string;
  room: { id: string; name: string };
} | null = null;

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useCloudsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        contextFolders: mockContextFolders,
        fetchContextFolders: mockFetchContextFolders,
        selectedContextFolder: mockSelectedContextFolder,
        selectContextFolder: mockSelectContextFolder,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

let mockDropdownItems: unknown[] = [];
let mockOnOpenChange: ((open: boolean) => void) | undefined;
let mockDropdownOpen: boolean | undefined;
vi.mock("../../../components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    open,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    items: unknown[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    mockDropdownItems = items;
    mockOnOpenChange = onOpenChange;
    mockDropdownOpen = open;
    return (
      <div data-testid="dropdown-menu" data-item-count={items.length}>
        {trigger}
      </div>
    );
  },
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button
      data-testid={
        (props["data-testid"] as string) ?? `icon-btn-${props.iconName}`
      }
      className={props.className as string}
    >
      {props.iconName as string}
    </button>
  ),
}));

vi.mock("../../../components/tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    tooltip,
    visible,
  }: {
    children: React.ReactNode;
    tooltip?: string;
    visible?: boolean;
  }) => (
    <div
      data-testid="tooltip-btn"
      data-tooltip={tooltip}
      data-visible={visible}
    >
      {children}
    </div>
  ),
}));

import { ComposerActionSettings } from "../sub-components/ComposerActionSettings";

type MenuItem = {
  id?: string;
  text: string;
  icon?: React.ReactNode;
  withToggle?: boolean;
  toggleChecked?: boolean;
  toggleDisabled?: boolean;
  tooltipText?: string;
  trailingText?: string;
  isSeparator?: boolean;
  onToggleChange?: () => Promise<void> | void;
  subMenu?: MenuItem[];
  checked?: boolean;
  onClick?: () => void;
};

const items = () => mockDropdownItems as MenuItem[];
const cloudRows = () =>
  items().filter((i) => i.id?.startsWith("context-cloud:"));

describe("ComposerActionSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextFolders = [];
    mockSelectedContextFolder = null;
    mockDropdownItems = [];
    mockOnOpenChange = undefined;
    mockDropdownOpen = undefined;
  });

  it("renders the cloud button with the Settings tooltip", () => {
    mockContextFolders = [
      { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
    ];
    render(<ComposerActionSettings />);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    const button = screen.getByTestId("composer-settings-button");
    expect(button.textContent).toBe("btn-cloud");
    // A filled glyph drawn upright — not the header's rotated cog.
    expect(button.className).not.toContain("rotate-90");
    expect(screen.getByTestId("tooltip-btn").getAttribute("data-tooltip")).toBe(
      "Settings"
    );
  });

  it("reads the context folders on mount", () => {
    render(<ComposerActionSettings />);
    expect(mockFetchContextFolders).toHaveBeenCalledTimes(1);
  });

  it("renders nothing at all while no clouds came back", () => {
    const { container } = render(<ComposerActionSettings />);
    expect(container).toBeEmptyDOMElement();
  });

  it("appears once the folders arrive, without fetching again", () => {
    const { rerender } = render(<ComposerActionSettings />);
    expect(screen.queryByTestId("dropdown-menu")).toBeNull();
    mockContextFolders = [
      { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
    ];
    rerender(<ComposerActionSettings />);
    expect(items()[0].id).toBe("context-cloud:a.example.com");
    expect(mockFetchContextFolders).toHaveBeenCalledTimes(1);
  });

  it("disappears again when the folders go away", () => {
    mockContextFolders = [
      { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
    ];
    const { rerender } = render(<ComposerActionSettings />);
    expect(items()[0].id).toBe("context-cloud:a.example.com");
    mockContextFolders = [];
    rerender(<ComposerActionSettings />);
    expect(screen.queryByTestId("dropdown-menu")).toBeNull();
  });

  describe("with context folders", () => {
    beforeEach(() => {
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

    it("lists exactly one row per cloud, nothing else", () => {
      render(<ComposerActionSettings />);
      expect(items().map((i) => i.text)).toEqual([
        "a.example.com",
        "b.example.com",
      ]);
      expect(items().find((i) => i.isSeparator)).toBeUndefined();
    });

    it("cloud rows carry the ONLYOFFICE icon and open one level of rooms", () => {
      render(<ComposerActionSettings />);
      const clouds = cloudRows();
      expect(clouds.map((c) => c.id)).toEqual([
        "context-cloud:a.example.com",
        "context-cloud:b.example.com",
      ]);
      for (const cloud of clouds) {
        expect(cloud.withToggle).toBeUndefined();
        expect(cloud.checked).toBeUndefined();
        const { container } = render(<>{cloud.icon}</>);
        expect(container.textContent).toBe("onlyoffice");
      }
      expect(clouds[0].subMenu!.map((r) => r.text)).toEqual([
        "Room 1",
        "Room 2",
      ]);
      expect(clouds[0].subMenu!.map((r) => r.id)).toEqual([
        "context-room:r1",
        "context-room:r2",
      ]);
      expect(clouds[1].subMenu!.map((r) => r.text)).toEqual(["Room 3"]);
      // Rooms are leaves: no further level.
      expect(clouds[1].subMenu![0].subMenu).toBeUndefined();
    });

    it("clicking a cloud row selects nothing", () => {
      render(<ComposerActionSettings />);
      for (const cloud of cloudRows()) cloud.onClick!();
      expect(mockSelectContextFolder).not.toHaveBeenCalled();
    });

    it("room rows are plain leaves — no toggle, unchecked by default", () => {
      render(<ComposerActionSettings />);
      const rooms = cloudRows().flatMap((c) => c.subMenu!);
      expect(rooms).toHaveLength(3);
      for (const room of rooms) {
        expect(room.withToggle).toBeUndefined();
        expect(room.checked).toBe(false);
        expect(room.subMenu).toBeUndefined();
      }
    });

    it("clicking a room stores it with its cloud right away", () => {
      render(<ComposerActionSettings />);
      act(() => {
        cloudRows()[1].subMenu![0].onClick!();
      });
      expect(mockSelectContextFolder).toHaveBeenCalledTimes(1);
      expect(mockSelectContextFolder).toHaveBeenCalledWith("b.example.com", {
        id: "r3",
        name: "Room 3",
      });
    });

    it("closes the menu on a room pick", () => {
      render(<ComposerActionSettings />);
      act(() => {
        mockOnOpenChange!(true);
      });
      expect(mockDropdownOpen).toBe(true);
      act(() => {
        cloudRows()[0].subMenu![0].onClick!();
      });
      expect(mockDropdownOpen).toBe(false);
    });

    it("passes the room object through untouched", () => {
      render(<ComposerActionSettings />);
      act(() => {
        cloudRows()[0].subMenu![1].onClick!();
      });
      const [, room] = mockSelectContextFolder.mock.calls[0];
      expect(room).toBe(mockContextFolders[0].rooms[1]);
    });

    it("marks the selected room, matching on cloud and room id", () => {
      // Same room id under another cloud must stay unchecked.
      mockContextFolders = [
        { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room A" }] },
        { cloud: "b.example.com", rooms: [{ id: "r1", name: "Room B" }] },
      ];
      mockSelectedContextFolder = {
        cloud: "b.example.com",
        room: { id: "r1", name: "Room B" },
      };
      render(<ComposerActionSettings />);
      const clouds = cloudRows();
      expect(clouds[0].subMenu![0].checked).toBe(false);
      expect(clouds[1].subMenu![0].checked).toBe(true);
    });

    it("a stale selection that no longer exists marks nothing", () => {
      mockSelectedContextFolder = {
        cloud: "gone.example.com",
        room: { id: "r9", name: "Gone" },
      };
      render(<ComposerActionSettings />);
      const checked = cloudRows()
        .flatMap((c) => c.subMenu!)
        .filter((r) => r.checked);
      expect(checked).toHaveLength(0);
    });

    it("keeps the cloud row even for a single cloud", () => {
      mockContextFolders = [
        { cloud: "only.example.com", rooms: [{ id: "r1", name: "Room" }] },
      ];
      render(<ComposerActionSettings />);
      expect(cloudRows().map((c) => c.text)).toEqual(["only.example.com"]);
      expect(cloudRows()[0].subMenu!.map((r) => r.text)).toEqual(["Room"]);
    });
  });

  it("provides onOpenChange to the dropdown", () => {
    mockContextFolders = [
      { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
    ];
    render(<ComposerActionSettings />);
    expect(mockOnOpenChange).toBeDefined();
  });
});
