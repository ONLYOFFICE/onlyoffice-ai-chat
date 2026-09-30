// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockChangeToolStatus = vi.fn();
const mockChangeAllToolStatus = vi.fn();
const mockGetCustomServersStoped = vi.fn().mockReturnValue([]);
const mockGetCustomServersLogs = vi.fn().mockReturnValue({});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => ({
    servers: {
      getCustomServersStoped: mockGetCustomServersStoped,
      getCustomServersLogs: mockGetCustomServersLogs,
    },
  }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        changeToolStatus: mockChangeToolStatus,
        changeAllToolStatus: mockChangeAllToolStatus,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../components/icon", () => ({
  Icon: () => <span data-testid="icon" />,
}));

vi.mock("../../../components/icon-button", () => ({
  IconButton: ({
    iconName,
    ...props
  }: {
    iconName: string;
    [key: string]: unknown;
  }) => <button data-testid={`icon-btn-${iconName}`} {...props} />,
}));

vi.mock("../../../components/loader", () => ({
  Loader: () => <div data-testid="loader" />,
}));

vi.mock("../../../components/toggle-button", () => ({
  ToggleButton: ({
    checked,
    disabled,
    onCheckedChange,
  }: {
    checked: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      data-testid="toggle"
      data-checked={String(checked)}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

import AvailableToolsItem from "../sub-components/AvailableToolsItem";

const mcpItems = [
  { name: "tool-a", description: "A", inputSchema: {}, enabled: true },
  { name: "tool-b", description: "B", inputSchema: {}, enabled: false },
];

describe("AvailableToolsItem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChangeToolStatus.mockClear();
    mockChangeAllToolStatus.mockClear();
    mockGetCustomServersStoped.mockReturnValue([]);
    mockGetCustomServersLogs.mockReturnValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders server name", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    expect(screen.getByText("my-server")).toBeInTheDocument();
  });

  it("shows loader when loading", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={[]}
        isLoading={true}
      />
    );
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("shows the all-tools toggle when not loading, ON while any tool is enabled", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    const toggle = screen.getByTestId("toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("data-checked", "true");
  });

  it("hides the all-tools toggle when the server has no tools", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={[]}
        isLoading={false}
      />
    );
    expect(screen.queryByTestId("toggle")).not.toBeInTheDocument();
  });

  it("shows tools when expanded by click", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    expect(screen.queryByText("tool-a")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("my-server"));
    expect(screen.getByText("tool-a")).toBeInTheDocument();
    expect(screen.getByText("tool-b")).toBeInTheDocument();
  });

  it("does not expand when loading", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={true}
      />
    );
    fireEvent.click(screen.getByText("my-server"));
    expect(screen.queryByText("tool-a")).not.toBeInTheDocument();
  });

  it("does not expand when mcpItems is empty", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={[]}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByText("my-server"));
    expect(screen.queryByText("tool-a")).not.toBeInTheDocument();
  });

  it("calls changeToolStatus when a tool row is clicked", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByText("my-server"));
    fireEvent.click(screen.getByText("tool-a"));
    expect(mockChangeToolStatus).toHaveBeenCalledWith(
      "my-server",
      "tool-a",
      false
    );
  });

  it("switching the toggle off disables all tools at once", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByTestId("toggle"));
    expect(mockChangeAllToolStatus).toHaveBeenCalledWith("my-server", false);
    expect(mockChangeAllToolStatus).toHaveBeenCalledTimes(1);
    expect(mockChangeToolStatus).not.toHaveBeenCalled();
  });

  it("switching the toggle on from all-disabled enables all tools at once", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems.map((tool) => ({ ...tool, enabled: false }))}
        isLoading={false}
      />
    );
    const toggle = screen.getByTestId("toggle");
    expect(toggle).toHaveAttribute("data-checked", "false");

    fireEvent.click(toggle);
    expect(mockChangeAllToolStatus).toHaveBeenCalledWith("my-server", true);
    expect(mockChangeAllToolStatus).toHaveBeenCalledTimes(1);
    expect(mockChangeToolStatus).not.toHaveBeenCalled();
  });

  it("clicking the toggle does not expand the tools list", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.queryByText("tool-a")).not.toBeInTheDocument();
  });

  it("shows error icon when server is stopped", () => {
    mockGetCustomServersStoped.mockReturnValue(["my-server"]);
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={true}
      />
    );
    // isStoped is set via interval, advance timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("mcp-server-error-icon")).toBeInTheDocument();
  });

  it("opens the crash log (not tools) when a stopped server is clicked, even with no tools", () => {
    mockGetCustomServersStoped.mockReturnValue(["my-server"]);
    mockGetCustomServersLogs.mockReturnValue({
      "my-server": ["boom-line-one\n", "boom-line-two\n"],
    });
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={[]}
        isLoading={true}
      />
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Collapsed by default — the log stays hidden until clicked.
    expect(screen.queryByText(/boom-line-one/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("my-server"));
    expect(screen.getByText(/boom-line-one/)).toBeInTheDocument();
    expect(screen.getByText(/boom-line-two/)).toBeInTheDocument();
  });

  it("opens the crash log when the error icon itself is clicked", () => {
    mockGetCustomServersStoped.mockReturnValue(["my-server"]);
    mockGetCustomServersLogs.mockReturnValue({ "my-server": ["crashed\n"] });
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={[]}
        isLoading={true}
      />
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByTestId("mcp-server-error-icon"));
    expect(screen.getByText(/crashed/)).toBeInTheDocument();
  });

  it("collapses when isLoading changes to true", () => {
    const { rerender } = render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByText("my-server"));
    expect(screen.getByText("tool-a")).toBeInTheDocument();

    rerender(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={true}
      />
    );
    expect(screen.queryByText("tool-a")).not.toBeInTheDocument();
  });
});
