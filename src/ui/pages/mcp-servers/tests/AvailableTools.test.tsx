// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetCustomServers = vi.fn().mockReturnValue({});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../tools/context", () => ({
  useToolsContext: () => ({
    servers: {
      getCustomServers: mockGetCustomServers,
      getHostToolGroupIds: () => ["desktop-editor"],
      getHostToolGroupDisplayName: (id: string) => id,
    },
  }),
}));

vi.mock("../../../../config", () => ({
  MAX_TOOL_COUNT: 100,
  MAX_TOOL_COUNT_WITH_WEB_SEARCH: 102,
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: () => ({
      servers: {
        "desktop-editor": [
          {
            name: "tool1",
            description: "desc",
            inputSchema: {},
            enabled: true,
          },
        ],
        "custom-server": [
          {
            name: "tool2",
            description: "desc2",
            inputSchema: {},
            enabled: false,
          },
        ],
      },
      tools: [],
      webSearchEnabled: false,
    }),
  }),
}));

vi.mock("../sub-components/AvailableToolsItem", () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid={`tools-item-${name}`}>{name}</div>
  ),
}));

vi.mock("../sub-components/ToolsCounter", () => ({
  default: () => <div data-testid="tools-counter" />,
}));

import AvailableTools from "../sub-components/AvailableTools";

describe("AvailableTools", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetCustomServers.mockReturnValue({});
  });

  it("renders desktop-editor tool item", () => {
    render(<AvailableTools />);
    expect(screen.getByTestId("tools-item-desktop-editor")).toBeInTheDocument();
  });

  it("renders header with Permissions text when withHeader is true", () => {
    render(<AvailableTools withHeader />);
    expect(screen.getByText("Permissions")).toBeInTheDocument();
    expect(screen.getByTestId("tools-counter")).toBeInTheDocument();
  });

  it("does not render header when withHeader is false", () => {
    render(<AvailableTools withHeader={false} />);
    expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
  });

  it("renders tool items for custom servers", () => {
    mockGetCustomServers.mockReturnValue({
      "my-server": {},
      "another-server": {},
    });
    render(<AvailableTools />);
    expect(screen.getByTestId("tools-item-my-server")).toBeInTheDocument();
    expect(screen.getByTestId("tools-item-another-server")).toBeInTheDocument();
  });

  it("polls custom servers on interval", () => {
    mockGetCustomServers.mockReturnValue({});
    render(<AvailableTools />);

    mockGetCustomServers.mockReturnValue({ "new-server": {} });
    vi.advanceTimersByTime(1000);

    // Called initially + on intervals; just verify it was called more than once
    expect(mockGetCustomServers.mock.calls.length).toBeGreaterThan(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
