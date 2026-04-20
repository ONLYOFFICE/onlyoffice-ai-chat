// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mockSetCurrentPage = vi.fn();
const mockOnSwitchToNewThread = vi.fn();
const mockUseWidgetConfig = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useRouter: (selector?: (s: unknown) => unknown) => {
      const state = {
        currentPage: "chat" as string,
        setCurrentPage: mockSetCurrentPage,
      };
      return selector ? selector(state) : state;
    },
    useThreadsStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        onSwitchToNewThread: mockOnSwitchToNewThread,
      };
      return selector ? selector(state) : state;
    },
  }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name, ...props }: { name: string }) => (
    <span data-testid={`icon-${name}`} {...props} />
  ),
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({
    iconName,
    onClick,
    isActive,
    ...rest
  }: {
    iconName: string;
    onClick?: () => void;
    isActive?: boolean;
    "data-testid"?: string;
  }) => (
    <button
      data-testid={rest["data-testid"] || `icon-btn-${iconName}`}
      data-active={String(!!isActive)}
      onClick={onClick}
    >
      {iconName}
    </button>
  ),
}));

vi.mock("../../tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    tooltip,
  }: {
    children: React.ReactNode;
    tooltip: string;
  }) => <div data-tooltip={tooltip}>{children}</div>,
}));

import { Navigation } from "../sub-components/Header";

describe("Navigation (Header)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWidgetConfig.mockReturnValue({});
  });

  it("renders the AIAgent title", () => {
    render(<Navigation />);
    expect(screen.getByText("AIAgent")).toBeInTheDocument();
  });

  it("renders all 3 action buttons", () => {
    render(<Navigation />);
    expect(screen.getByTestId("new-chat-button")).toBeInTheDocument();
    expect(screen.getByTestId("chat-history-button")).toBeInTheDocument();
    expect(screen.getByTestId("settings-button")).toBeInTheDocument();
  });

  it("renders tooltips for all buttons", () => {
    const { container } = render(<Navigation />);
    const tooltips = container.querySelectorAll("[data-tooltip]");
    expect(tooltips).toHaveLength(3);
    expect(tooltips[0]).toHaveAttribute("data-tooltip", "NewChat");
    expect(tooltips[1]).toHaveAttribute("data-tooltip", "ChatHistory");
    expect(tooltips[2]).toHaveAttribute("data-tooltip", "Settings");
  });

  it("clicking new chat calls setCurrentPage and onSwitchToNewThread", () => {
    render(<Navigation />);
    fireEvent.click(screen.getByTestId("new-chat-button"));
    expect(mockSetCurrentPage).toHaveBeenCalledWith("chat");
    expect(mockOnSwitchToNewThread).toHaveBeenCalled();
  });

  it("clicking settings toggles to settings page", () => {
    render(<Navigation />);
    fireEvent.click(screen.getByTestId("settings-button"));
    expect(mockSetCurrentPage).toHaveBeenCalledWith("settings");
  });

  it("clicking chat history toggles to history page", () => {
    render(<Navigation />);
    fireEvent.click(screen.getByTestId("chat-history-button"));
    expect(mockSetCurrentPage).toHaveBeenCalledWith("history");
  });

  it("clicking settings when already on settings toggles back to chat", async () => {
    // Override mock for this test to simulate being on settings page
    const mod = await import("../../../store/context");
    vi.spyOn(mod, "useStores").mockReturnValue({
      useRouter: ((selector?: (s: unknown) => unknown) => {
        const state = {
          currentPage: "settings",
          setCurrentPage: mockSetCurrentPage,
        };
        return selector ? selector(state) : state;
      }) as unknown as ReturnType<typeof mod.useStores>["useRouter"],
      useThreadsStore: ((selector?: (s: unknown) => unknown) => {
        const state = { onSwitchToNewThread: mockOnSwitchToNewThread };
        return selector ? selector(state) : state;
      }) as unknown as ReturnType<typeof mod.useStores>["useThreadsStore"],
    } as ReturnType<typeof mod.useStores>);

    render(<Navigation />);
    fireEvent.click(screen.getByTestId("settings-button"));
    expect(mockSetCurrentPage).toHaveBeenCalledWith("chat");
  });

  it("clicking history when already on history toggles back to chat", async () => {
    const mod = await import("../../../store/context");
    vi.spyOn(mod, "useStores").mockReturnValue({
      useRouter: ((selector?: (s: unknown) => unknown) => {
        const state = {
          currentPage: "history",
          setCurrentPage: mockSetCurrentPage,
        };
        return selector ? selector(state) : state;
      }) as unknown as ReturnType<typeof mod.useStores>["useRouter"],
      useThreadsStore: ((selector?: (s: unknown) => unknown) => {
        const state = { onSwitchToNewThread: mockOnSwitchToNewThread };
        return selector ? selector(state) : state;
      }) as unknown as ReturnType<typeof mod.useStores>["useThreadsStore"],
    } as ReturnType<typeof mod.useStores>);

    render(<Navigation />);
    fireEvent.click(screen.getByTestId("chat-history-button"));
    expect(mockSetCurrentPage).toHaveBeenCalledWith("chat");
  });

  it("hides the settings button when hideSettingsButton is true", () => {
    mockUseWidgetConfig.mockReturnValue({ hideSettingsButton: true });
    render(<Navigation />);
    expect(screen.queryByTestId("settings-button")).not.toBeInTheDocument();
  });

  it("calls onSettingsClick instead of setCurrentPage when provided", () => {
    const handler = vi.fn();
    mockUseWidgetConfig.mockReturnValue({ onSettingsClick: handler });
    render(<Navigation />);
    fireEvent.click(screen.getByTestId("settings-button"));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentPage).not.toHaveBeenCalled();
  });

  it("uses isSettingsActive override to force the active state", () => {
    mockUseWidgetConfig.mockReturnValue({ isSettingsActive: true });
    render(<Navigation />);
    // currentPage is "chat" in the default mock, but override forces active=true
    const btn = screen.getByTestId("settings-button");
    expect(btn.getAttribute("data-active")).toBe("true");
  });

  it("isSettingsActive=false forces inactive even on the settings page", async () => {
    mockUseWidgetConfig.mockReturnValue({ isSettingsActive: false });
    const mod = await import("../../../store/context");
    vi.spyOn(mod, "useStores").mockReturnValue({
      useRouter: ((selector?: (s: unknown) => unknown) => {
        const state = {
          currentPage: "settings",
          setCurrentPage: mockSetCurrentPage,
        };
        return selector ? selector(state) : state;
      }) as unknown as ReturnType<typeof mod.useStores>["useRouter"],
      useThreadsStore: ((selector?: (s: unknown) => unknown) => {
        const state = { onSwitchToNewThread: mockOnSwitchToNewThread };
        return selector ? selector(state) : state;
      }) as unknown as ReturnType<typeof mod.useStores>["useThreadsStore"],
    } as ReturnType<typeof mod.useStores>);

    render(<Navigation />);
    const btn = screen.getByTestId("settings-button");
    expect(btn.getAttribute("data-active")).toBe("false");
  });
});
