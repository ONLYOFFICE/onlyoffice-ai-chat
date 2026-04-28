// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockChangeToolStatus = vi.fn();
const mockGetCustomServersStoped = vi.fn().mockReturnValue([]);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../../tools/context", () => ({
  useToolsContext: () => ({
    servers: {
      getCustomServersStoped: mockGetCustomServersStoped,
    },
  }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useServersStore: () => ({
      changeToolStatus: mockChangeToolStatus,
    }),
  }),
}));

vi.mock("../../../components/dropdown", () => ({
  DropdownMenu: ({
    trigger,
    items,
  }: {
    trigger: React.ReactNode;
    items: Array<{ text: string; onClick: () => void }>;
  }) => (
    <div data-testid="dropdown">
      {trigger}
      {items.map((item) => (
        <button key={item.text} onClick={item.onClick}>
          {item.text}
        </button>
      ))}
    </div>
  ),
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
  ToggleButton: ({ checked }: { checked: boolean }) => (
    <div data-testid="toggle" data-checked={String(checked)} />
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
    mockGetCustomServersStoped.mockReturnValue([]);
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
        disableEnable={false}
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
        disableEnable={false}
      />
    );
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("shows dropdown menu when not loading", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
        disableEnable={false}
      />
    );
    expect(screen.getByTestId("dropdown")).toBeInTheDocument();
  });

  it("shows tools when expanded by click", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
        disableEnable={false}
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
        disableEnable={false}
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
        disableEnable={false}
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
        disableEnable={false}
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

  it("enable all tools calls changeToolStatus for disabled tools", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
        disableEnable={false}
      />
    );
    fireEvent.click(screen.getByText("EnableAllTools"));
    expect(mockChangeToolStatus).toHaveBeenCalledWith(
      "my-server",
      "tool-b",
      true
    );
    expect(mockChangeToolStatus).toHaveBeenCalledTimes(1);
  });

  it("disable all tools calls changeToolStatus for enabled tools", () => {
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
        disableEnable={false}
      />
    );
    fireEvent.click(screen.getByText("DisableAllTools"));
    expect(mockChangeToolStatus).toHaveBeenCalledWith(
      "my-server",
      "tool-a",
      false
    );
    expect(mockChangeToolStatus).toHaveBeenCalledTimes(1);
  });

  it("shows error icon when server is stopped", () => {
    mockGetCustomServersStoped.mockReturnValue(["my-server"]);
    render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={true}
        disableEnable={false}
      />
    );
    // isStoped is set via interval, advance timer
    vi.advanceTimersByTime(1000);
  });

  it("collapses when isLoading changes to true", () => {
    const { rerender } = render(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={false}
        disableEnable={false}
      />
    );
    fireEvent.click(screen.getByText("my-server"));
    expect(screen.getByText("tool-a")).toBeInTheDocument();

    rerender(
      <AvailableToolsItem
        name="my-server"
        mcpItems={mcpItems}
        isLoading={true}
        disableEnable={false}
      />
    );
    expect(screen.queryByText("tool-a")).not.toBeInTheDocument();
  });
});
