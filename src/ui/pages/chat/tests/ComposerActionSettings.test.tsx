// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockChangeToolStatus = vi.fn();
const mockSetReasoningLevel = vi.fn();
const mockEmit = vi.fn();

let mockWebSearchEnabled = false;
let mockDisabledTools: Record<string, string[]> = {};
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
  text: string;
  withToggle?: boolean;
  toggleChecked?: boolean;
  toggleDisabled?: boolean;
  tooltipText?: string;
  trailingText?: string;
  isSeparator?: boolean;
  onToggleChange?: () => Promise<void> | void;
  subMenu?: { text: string; checked?: boolean; onClick: () => void }[];
};

const items = () => mockDropdownItems as MenuItem[];
const webSearchItem = () => items().find((i) => i.text === "WebSearch");
const effortItem = () => items().find((i) => i.text === "Effort");

describe("ComposerActionSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSearchEnabled = false;
    mockDisabledTools = {};
    mockReasoningLevel = "off";
    mockReasoningSupport = {
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    };
    mockDropdownItems = [];
    mockOnOpenChange = undefined;
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

  it("lists web search and effort, nothing else", () => {
    render(<ComposerActionSettings />);
    expect(items().map((i) => i.text)).toEqual(["WebSearch", "Effort"]);
    expect(items().find((i) => i.isSeparator)).toBeUndefined();
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
      effortItem()!.subMenu![3].onClick();
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
