// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ContextFolder } from "../../../../core/storage";

const mockChangeToolStatus = vi.fn();
const mockSetReasoningLevel = vi.fn();
const mockEmit = vi.fn();

const mockFetchContextFolders = vi.fn();
const mockSelectContextFolder = vi.fn();

let mockWebSearchEnabled = false;
let mockDisabledTools: Record<string, string[]> = {};
let mockContextFolders: ContextFolder[] = [];
let mockSelectedContextFolder: {
  cloud: string;
  room: { id: string; name: string };
} | null = null;
let mockReasoningLevel = "off";
let mockReasoningSupport = {
  thinks: true,
  canDisable: true,
  depths: ["low", "medium", "high", "max"],
};

vi.mock("../../../hooks/useReasoningSupport", () => ({
  useReasoningSupport: () => mockReasoningSupport,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        changeToolStatus: mockChangeToolStatus,
        webSearchEnabled: mockWebSearchEnabled,
        disabledTools: mockDisabledTools,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    useProfilesStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        reasoningLevel: mockReasoningLevel,
        setReasoningLevel: mockSetReasoningLevel,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
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

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => ({
    eventBus: { emit: mockEmit },
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
      <button data-testid="connect-room-cancel" onClick={onClose}>
        cancel
      </button>
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
const webSearchItem = () => items().find((i) => i.text === "WebSearch");
const effortItem = () => items().find((i) => i.text === "Effort");

describe("ComposerActionSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSearchEnabled = false;
    mockDisabledTools = {};
    mockContextFolders = [];
    mockSelectedContextFolder = null;
    mockReasoningLevel = "off";
    mockReasoningSupport = {
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    };
    mockDropdownItems = [];
    mockOnOpenChange = undefined;
    mockDropdownOpen = undefined;
  });

  it("renders the settings cog with the Settings tooltip", () => {
    render(<ComposerActionSettings />);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    const button = screen.getByTestId("composer-settings-button");
    expect(button.textContent).toBe("btn-settings");
    // Same orientation as the header's settings button.
    expect(button.className).toContain("rotate-90");
    expect(screen.getByTestId("tooltip-btn").getAttribute("data-tooltip")).toBe(
      "Settings"
    );
  });

  it("reads the context folders on mount", () => {
    render(<ComposerActionSettings />);
    expect(mockFetchContextFolders).toHaveBeenCalledTimes(1);
  });

  it("lists only web search and effort while no clouds came back", () => {
    render(<ComposerActionSettings />);
    expect(items().map((i) => i.text)).toEqual(["WebSearch", "Effort"]);
    expect(items().find((i) => i.isSeparator)).toBeUndefined();
  });

  it("adds the cloud rows once the folders arrive, without fetching again", () => {
    const { rerender } = render(<ComposerActionSettings />);
    expect(items().map((i) => i.text)).toEqual(["WebSearch", "Effort"]);
    mockContextFolders = [
      { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
    ];
    rerender(<ComposerActionSettings />);
    expect(items()[0].id).toBe("context-cloud:a.example.com");
    expect(mockFetchContextFolders).toHaveBeenCalledTimes(1);
  });

  it("drops the cloud rows again when the folders go away", () => {
    mockContextFolders = [
      { cloud: "a.example.com", rooms: [{ id: "r1", name: "Room 1" }] },
    ];
    const { rerender } = render(<ComposerActionSettings />);
    expect(items()[0].id).toBe("context-cloud:a.example.com");
    mockContextFolders = [];
    rerender(<ComposerActionSettings />);
    expect(items().map((i) => i.text)).toEqual(["WebSearch", "Effort"]);
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

    it("puts one row per cloud at the root, separated from the switches", () => {
      render(<ComposerActionSettings />);
      expect(items().map((i) => i.text)).toEqual([
        "a.example.com",
        "b.example.com",
        "",
        "WebSearch",
        "Effort",
      ]);
      expect(items()[2].isSeparator).toBe(true);
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

    it("clicking a room asks for confirmation instead of selecting", () => {
      render(<ComposerActionSettings />);
      expect(screen.queryByTestId("connect-room-dialog")).toBeNull();
      act(() => {
        cloudRows()[1].subMenu![0].onClick!();
      });
      const dialog = screen.getByTestId("connect-room-dialog");
      expect(dialog.getAttribute("data-cloud")).toBe("b.example.com");
      expect(dialog.getAttribute("data-room")).toBe("r3");
      expect(mockSelectContextFolder).not.toHaveBeenCalled();
    });

    it("closes the menu when the dialog opens", () => {
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

    it("Connect stores the room with its cloud and dismisses the dialog", () => {
      render(<ComposerActionSettings />);
      act(() => {
        cloudRows()[1].subMenu![0].onClick!();
      });
      fireEvent.click(screen.getByTestId("connect-room-confirm"));
      expect(mockSelectContextFolder).toHaveBeenCalledTimes(1);
      expect(mockSelectContextFolder).toHaveBeenCalledWith("b.example.com", {
        id: "r3",
        name: "Room 3",
      });
      expect(screen.queryByTestId("connect-room-dialog")).toBeNull();
    });

    it("Connect passes the room object through untouched", () => {
      render(<ComposerActionSettings />);
      act(() => {
        cloudRows()[0].subMenu![1].onClick!();
      });
      fireEvent.click(screen.getByTestId("connect-room-confirm"));
      const [, room] = mockSelectContextFolder.mock.calls[0];
      expect(room).toBe(mockContextFolders[0].rooms[1]);
    });

    it("Cancel dismisses the dialog without selecting", () => {
      render(<ComposerActionSettings />);
      act(() => {
        cloudRows()[0].subMenu![0].onClick!();
      });
      fireEvent.click(screen.getByTestId("connect-room-cancel"));
      expect(mockSelectContextFolder).not.toHaveBeenCalled();
      expect(screen.queryByTestId("connect-room-dialog")).toBeNull();
    });

    it("picking another room replaces the pending one", () => {
      render(<ComposerActionSettings />);
      act(() => {
        cloudRows()[0].subMenu![0].onClick!();
      });
      act(() => {
        cloudRows()[1].subMenu![0].onClick!();
      });
      expect(
        screen.getByTestId("connect-room-dialog").getAttribute("data-room")
      ).toBe("r3");
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
    render(<ComposerActionSettings />);
    expect(mockOnOpenChange).toBeDefined();
  });

  describe("web search toggle", () => {
    it("is disabled with a hint while web search is not configured", () => {
      render(<ComposerActionSettings />);
      expect(webSearchItem()?.withToggle).toBe(true);
      expect(webSearchItem()?.toggleChecked).toBe(false);
      expect(webSearchItem()?.toggleDisabled).toBe(true);
      expect(webSearchItem()?.tooltipText).toBe("EnableWebSearch");
    });

    it("is on when configured and no web-search tool is disabled", () => {
      mockWebSearchEnabled = true;
      render(<ComposerActionSettings />);
      expect(webSearchItem()?.toggleChecked).toBe(true);
      expect(webSearchItem()?.toggleDisabled).toBe(false);
      expect(webSearchItem()?.tooltipText).toBe("");
    });

    it("flips both tools off in one write and emits tools-changed", async () => {
      mockWebSearchEnabled = true;
      render(<ComposerActionSettings />);
      await webSearchItem()!.onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledTimes(1);
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "web-search",
        ["web_search", "web_crawling"],
        false
      );
      expect(mockEmit).toHaveBeenCalledWith("tools-changed");
    });

    it("flips both tools on when all are disabled", async () => {
      mockWebSearchEnabled = true;
      mockDisabledTools = { "web-search": ["web_search", "web_crawling"] };
      render(<ComposerActionSettings />);
      expect(webSearchItem()?.toggleChecked).toBe(false);
      await webSearchItem()!.onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "web-search",
        ["web_search", "web_crawling"],
        true
      );
    });

    it("does nothing when web search is not configured", async () => {
      render(<ComposerActionSettings />);
      await webSearchItem()!.onToggleChange!();
      expect(mockChangeToolStatus).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe("effort item", () => {
    it("shows the current depth with a picker", () => {
      mockReasoningLevel = "medium";
      render(<ComposerActionSettings />);
      expect(effortItem()?.trailingText).toBe("ThinkingLevelMedium");
      expect(effortItem()?.subMenu?.map((i) => i.text)).toEqual([
        "NoThinking",
        "ThinkingLevelLow",
        "ThinkingLevelMedium",
        "ThinkingLevelHigh",
        "ThinkingLevelMax",
      ]);
      expect(effortItem()?.subMenu?.find((i) => i.checked)?.text).toBe(
        "ThinkingLevelMedium"
      );
    });

    it("sets the picked level", () => {
      render(<ComposerActionSettings />);
      effortItem()!.subMenu![3].onClick!();
      expect(mockSetReasoningLevel).toHaveBeenCalledWith("high");
    });

    it("omits the row for a model that cannot think", () => {
      mockReasoningSupport = { thinks: false, canDisable: false, depths: [] };
      render(<ComposerActionSettings />);
      expect(effortItem()).toBeUndefined();
      expect(items().map((i) => i.text)).toEqual(["WebSearch"]);
    });
  });
});
