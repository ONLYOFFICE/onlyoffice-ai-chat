// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockChangeToolStatus = vi.fn();
const mockToggleExtendedThinking = vi.fn();
const mockSetReasoningLevel = vi.fn();
const mockEmit = vi.fn();

let mockServers: Record<string, { name: string; enabled: boolean }[]> = {};
let mockWebSearchEnabled = false;
let mockGetWebSearchEnabled = () => false;
let mockExtendedThinking = false;
let mockReasoningLevel = "off";
let mockReasoningSupport = {
  thinks: true,
  canDisable: true,
  depths: ["low", "medium", "high", "max"],
};

vi.mock("../../../hooks/useReasoningSupport", () => ({
  useReasoningSupport: () => mockReasoningSupport,
}));
let mockDisabledTools: Record<string, string[]> = {};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        servers: mockServers,
        changeToolStatus: mockChangeToolStatus,
        webSearchEnabled: mockWebSearchEnabled,
        getWebSearchEnabled: mockGetWebSearchEnabled,
        disabledTools: mockDisabledTools,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    useProfilesStore: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        extendedThinking: mockExtendedThinking,
        toggleExtendedThinking: mockToggleExtendedThinking,
        reasoningLevel: mockReasoningLevel,
        setReasoningLevel: mockSetReasoningLevel,
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
vi.mock("../../../components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
    onOpenChange,
  }: {
    trigger: React.ReactNode;
    items: unknown[];
    onOpenChange?: (open: boolean) => void;
  }) => {
    mockDropdownItems = items;
    mockOnOpenChange = onOpenChange;
    return (
      <div data-testid="dropdown-menu" data-item-count={items.length}>
        {trigger}
      </div>
    );
  },
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: (props: Record<string, unknown>) => (
    <button data-testid={`icon-btn-${props.iconName}`}>
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

import { ServersSettings } from "../sub-components/ComposerActionServers";

describe("ServersSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServers = {
      "web-search": [{ name: "web-search-tool", enabled: true }],
    };
    mockWebSearchEnabled = false;
    mockGetWebSearchEnabled = () => false;
    mockExtendedThinking = false;
    mockReasoningLevel = "off";
    mockReasoningSupport = {
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    };
    mockDisabledTools = {};
    mockDropdownItems = [];
    mockOnOpenChange = undefined;
  });

  it("renders the dropdown trigger", () => {
    render(<ServersSettings />);
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("renders the tools icon button", () => {
    render(<ServersSettings />);
    expect(screen.getByTestId("icon-btn-tools")).toBeInTheDocument();
  });

  it("renders MCP servers tooltip", () => {
    render(<ServersSettings />);
    const tooltip = screen.getByTestId("tooltip-btn");
    expect(tooltip.getAttribute("data-tooltip")).toBe("MCPServers");
  });

  it("handles empty servers rendering correctly", () => {
    mockServers = {};
    render(<ServersSettings />);
    // Still renders the dropdown with base items
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  it("includes web search, extended thinking, and separator = 3 base items", () => {
    render(<ServersSettings />);
    // web-search server only has 0 sub-items after the filter (subMenu: []),
    // so it's filtered out. 3 base items remain.
    expect(mockDropdownItems).toHaveLength(3);
  });

  describe("web search item", () => {
    it("renders with toggle and disabled state when not enabled", () => {
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        withToggle?: boolean;
        toggleChecked?: boolean;
        toggleDisabled?: boolean;
        tooltipText?: string;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch");
      expect(wsItem).toBeDefined();
      expect(wsItem?.withToggle).toBe(true);
      expect(wsItem?.toggleChecked).toBe(false);
      expect(wsItem?.toggleDisabled).toBe(true);
      expect(wsItem?.tooltipText).toBe("EnableWebSearch");
    });

    it("renders enabled when getWebSearchEnabled returns true", () => {
      mockGetWebSearchEnabled = () => true;
      mockWebSearchEnabled = true;
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        toggleChecked?: boolean;
        toggleDisabled?: boolean;
        tooltipText?: string;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch");
      expect(wsItem?.toggleChecked).toBe(true);
      expect(wsItem?.toggleDisabled).toBe(false);
      expect(wsItem?.tooltipText).toBe("");
    });

    it("onToggleChange flips every web-search tool and emits tools-changed", async () => {
      mockGetWebSearchEnabled = () => true;
      mockWebSearchEnabled = true;
      // All tools disabled → toggle is OFF; clicking should enable all.
      mockDisabledTools = { "web-search": ["web_search", "web_crawling"] };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        onToggleChange?: () => Promise<void> | void;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch")!;
      await wsItem.onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "web-search",
        ["web_search", "web_crawling"],
        true
      );
      expect(mockEmit).toHaveBeenCalledWith("tools-changed");
    });

    it("toggles from enabled to disabled", async () => {
      mockGetWebSearchEnabled = () => true;
      mockWebSearchEnabled = true;
      // No web-search tools disabled → toggle is ON; clicking should disable all.
      mockDisabledTools = {};
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        onToggleChange?: () => Promise<void> | void;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch")!;
      await wsItem.onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "web-search",
        ["web_search", "web_crawling"],
        false
      );
    });

    it("does nothing when web-search is not configured", async () => {
      mockWebSearchEnabled = false;
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        onToggleChange?: () => Promise<void> | void;
      }[];
      const wsItem = items.find((i) => i.text === "WebSearch")!;
      await wsItem.onToggleChange!();
      expect(mockChangeToolStatus).not.toHaveBeenCalled();
    });
  });

  describe("effort item", () => {
    type EffortItem = {
      text: string;
      trailingText?: string;
      withAbout?: boolean;
      withToggle?: boolean;
      subMenuMaxHeight?: string;
      subMenu?: { text: string; checked?: boolean; onClick: () => void }[];
    };
    const effortItem = () =>
      (mockDropdownItems as EffortItem[]).find((i) => i.text === "Effort");

    it("renders one Effort row with the current depth and a picker, no toggle", () => {
      mockExtendedThinking = true;
      mockReasoningLevel = "medium";
      render(<ServersSettings />);
      const item = effortItem();
      expect(item).toBeDefined();
      expect(item?.withToggle).toBeUndefined();
      expect(item?.withAbout).toBe(true);
      expect(item?.subMenuMaxHeight).toBe(
        "var(--radix-dropdown-menu-content-available-height)"
      );
      expect(item?.trailingText).toBe("ThinkingLevelMedium");
      expect(item?.subMenu?.map((i) => i.text)).toEqual([
        "Off",
        "ThinkingLevelLow",
        "ThinkingLevelMedium",
        "ThinkingLevelHigh",
        "ThinkingLevelMax",
      ]);
      expect(item?.subMenu?.find((i) => i.checked)?.text).toBe(
        "ThinkingLevelMedium"
      );
      expect(
        (mockDropdownItems as { text: string }[]).find(
          (i) => i.text === "ExtendedThinking"
        )
      ).toBeUndefined();
    });

    it("shows Off as the value while thinking is off", () => {
      mockReasoningLevel = "off";
      render(<ServersSettings />);
      expect(effortItem()?.trailingText).toBe("Off");
      expect(effortItem()?.subMenu?.find((i) => i.checked)?.text).toBe("Off");
    });

    it("sets the picked level", () => {
      render(<ServersSettings />);
      effortItem()!.subMenu![3].onClick();
      expect(mockSetReasoningLevel).toHaveBeenCalledWith("high");
      effortItem()!.subMenu![0].onClick();
      expect(mockSetReasoningLevel).toHaveBeenCalledWith("off");
    });

    it("omits the row for a model that cannot think", () => {
      mockReasoningSupport = { thinks: false, canDisable: false, depths: [] };
      render(<ServersSettings />);
      expect(effortItem()).toBeUndefined();
    });

    it("omits Off for a model that thinks always", () => {
      mockReasoningSupport = {
        thinks: true,
        canDisable: false,
        depths: ["low", "medium", "high", "max"],
      };
      mockReasoningLevel = "off";
      render(<ServersSettings />);
      expect(effortItem()?.subMenu?.map((i) => i.text)).toEqual([
        "ThinkingLevelLow",
        "ThinkingLevelMedium",
        "ThinkingLevelHigh",
        "ThinkingLevelMax",
      ]);
      // No switch here: a stored "off" is the standard depth, medium.
      expect(effortItem()?.trailingText).toBe("ThinkingLevelMedium");
      expect(effortItem()?.subMenu?.find((i) => i.checked)?.text).toBe(
        "ThinkingLevelMedium"
      );
    });

    it("lists only the depths the model distinguishes and marks the effective one", () => {
      mockReasoningSupport = {
        thinks: true,
        canDisable: false,
        depths: ["low", "high"],
      };
      mockReasoningLevel = "medium";
      render(<ServersSettings />);
      const item = effortItem();
      expect(item?.subMenu?.map((i) => i.text)).toEqual([
        "ThinkingLevelLow",
        "ThinkingLevelHigh",
      ]);
      // medium is not offered; the model runs high, so high is shown.
      expect(item?.trailingText).toBe("ThinkingLevelHigh");
      expect(item?.subMenu?.find((i) => i.checked)?.text).toBe(
        "ThinkingLevelHigh"
      );
    });

    it("falls back to Off / On for a model with a switch but no depth", () => {
      mockReasoningSupport = { thinks: true, canDisable: true, depths: [] };
      mockReasoningLevel = "high";
      render(<ServersSettings />);
      const item = effortItem();
      expect(item?.subMenu?.map((i) => i.text)).toEqual(["Off", "On"]);
      expect(item?.trailingText).toBe("On");
      item!.subMenu![1].onClick();
      expect(mockSetReasoningLevel).toHaveBeenCalledWith("medium");
    });

    it("omits the row for a model that thinks always with no depth knob", () => {
      mockReasoningSupport = { thinks: true, canDisable: false, depths: [] };
      render(<ServersSettings />);
      expect(effortItem()).toBeUndefined();
    });
  });

  describe("separator", () => {
    it("renders a separator item", () => {
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        isSeparator?: boolean;
      }[];
      const sepItem = items.find((i) => i.isSeparator);
      expect(sepItem).toBeDefined();
      expect(sepItem?.text).toBe("");
    });
  });

  describe("server type items", () => {
    it("renders server entries with more than 2 sub-items", () => {
      mockServers = {
        "web-search": [{ name: "web-search-tool", enabled: true }],
        "mcp-server": [
          { name: "tool-1", enabled: true },
          { name: "tool-2", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const count = (mockDropdownItems as unknown[]).length;
      // web search + extended thinking + separator + mcp-server = 4
      expect(count).toBe(4);
    });

    it("filters out server entries with 2 or fewer sub-items (web-search only)", () => {
      mockServers = {
        "web-search": [{ name: "web-search-tool", enabled: true }],
      };
      render(<ServersSettings />);
      // web-search gets empty subMenu, so filtered out
      expect(mockDropdownItems).toHaveLength(3);
    });

    it("server subMenu has 'All tools' toggle + separator + individual tools", () => {
      mockServers = {
        "web-search": [{ name: "web-search-tool", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: true },
          { name: "tool-b", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          withToggle?: boolean;
          toggleChecked?: boolean;
          onToggleChange?: (checked?: boolean) => void;
        }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      expect(serverItem.subMenu).toHaveLength(4); // All tools + separator + tool-a + tool-b
      expect(serverItem.subMenu![0].text).toBe("AllTools");
      expect(serverItem.subMenu![0].withToggle).toBe(true);
      expect(serverItem.subMenu![1].text).toBe(""); // separator
      expect(serverItem.subMenu![2].text).toBe("tool-a");
      expect(serverItem.subMenu![3].text).toBe("tool-b");
    });

    it("'All tools' toggle is checked when some tools are enabled", () => {
      mockServers = {
        "web-search": [{ name: "ws", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: true },
          { name: "tool-b", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; toggleChecked?: boolean }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      expect(serverItem.subMenu![0].toggleChecked).toBe(true);
    });

    it("'All tools' toggle is unchecked when no tools are enabled", () => {
      mockServers = {
        "web-search": [{ name: "ws", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: false },
          { name: "tool-b", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; toggleChecked?: boolean }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      expect(serverItem.subMenu![0].toggleChecked).toBe(false);
    });

    it("'All tools' onToggleChange disables all tools when some are enabled", () => {
      mockServers = {
        "web-search": [{ name: "ws", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: true },
          { name: "tool-b", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          onToggleChange?: (checked?: boolean) => void;
        }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      serverItem.subMenu![0].onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "my-server",
        "tool-a",
        false
      );
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "my-server",
        "tool-b",
        false
      );
    });

    it("'All tools' onToggleChange enables all tools when none are enabled", () => {
      mockServers = {
        "web-search": [{ name: "ws", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: false },
          { name: "tool-b", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          onToggleChange?: (checked?: boolean) => void;
        }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      serverItem.subMenu![0].onToggleChange!();
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "my-server",
        "tool-a",
        true
      );
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "my-server",
        "tool-b",
        true
      );
    });

    it("individual tool toggle calls changeToolStatus with checked value", () => {
      mockServers = {
        "web-search": [{ name: "ws", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: true },
          { name: "tool-b", enabled: false },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: {
          text: string;
          toggleChecked?: boolean;
          onToggleChange?: (checked: boolean) => void;
        }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      // tool-a is at index 2
      expect(serverItem.subMenu![2].toggleChecked).toBe(true);
      serverItem.subMenu![2].onToggleChange!(false);
      expect(mockChangeToolStatus).toHaveBeenCalledWith(
        "my-server",
        "tool-a",
        false
      );
    });

    it("individual tool toggle reflects enabled state", () => {
      mockServers = {
        "web-search": [{ name: "ws", enabled: true }],
        "my-server": [
          { name: "tool-a", enabled: false },
          { name: "tool-b", enabled: true },
        ],
      };
      render(<ServersSettings />);
      const items = mockDropdownItems as {
        text: string;
        subMenu?: { text: string; toggleChecked?: boolean }[];
      }[];
      const serverItem = items.find((i) => i.text === "my-server")!;
      expect(serverItem.subMenu![2].toggleChecked).toBe(false); // tool-a
      expect(serverItem.subMenu![3].toggleChecked).toBe(true); // tool-b
    });
  });

  describe("onOpenChange", () => {
    it("provides onOpenChange to dropdown", () => {
      render(<ServersSettings />);
      expect(mockOnOpenChange).toBeDefined();
    });
  });

  it("renders with empty servers object", () => {
    mockServers = {};
    render(<ServersSettings />);
    const dropdown = screen.getByTestId("dropdown-menu");
    expect(dropdown.getAttribute("data-item-count")).toBe("3");
  });

  it("renders multiple server types", () => {
    mockServers = {
      "web-search": [{ name: "ws", enabled: true }],
      "server-a": [
        { name: "t1", enabled: true },
        { name: "t2", enabled: true },
      ],
      "server-b": [
        { name: "t3", enabled: false },
        { name: "t4", enabled: false },
        { name: "t5", enabled: true },
      ],
    };
    render(<ServersSettings />);
    const count = (mockDropdownItems as unknown[]).length;
    // 3 base + server-a (4 sub > 2) + server-b (5 sub > 2) = 5
    expect(count).toBe(5);
  });
});
