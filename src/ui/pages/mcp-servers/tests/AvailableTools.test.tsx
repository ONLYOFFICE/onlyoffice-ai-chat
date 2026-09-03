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

const baseStoreState = () => ({
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
  } as Record<string, unknown[]>,
  tools: [],
  systemTools: {} as Record<string, unknown[]>,
  systemToolsErrors: {} as Record<string, string>,
  registeredServers: [] as string[],
  webSearchEnabled: false,
});

let mockStoreState = baseStoreState();

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: (selector?: (s: unknown) => unknown) =>
      typeof selector === "function" ? selector(mockStoreState) : mockStoreState,
  }),
}));

vi.mock("../sub-components/AvailableToolsItem", () => ({
  default: ({
    name,
    isLoading,
    failedText,
  }: {
    name: string;
    isLoading: boolean;
    failedText?: string;
  }) => (
    <div
      data-testid={`tools-item-${name}`}
      data-loading={String(isLoading)}
      data-failed-text={failedText ?? ""}
    >
      {name}
    </div>
  ),
}));

import AvailableTools from "../sub-components/AvailableTools";

describe("AvailableTools", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetCustomServers.mockReturnValue({});
    mockStoreState = baseStoreState();
  });

  it("renders desktop-editor tool item", () => {
    render(<AvailableTools />);
    expect(screen.getByTestId("tools-item-desktop-editor")).toBeInTheDocument();
  });

  it("renders header with Permissions text when withHeader is true", () => {
    render(<AvailableTools withHeader />);
    expect(screen.getByText("Permissions")).toBeInTheDocument();
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

  it("shows a loading card for a registered host-executed server before its tools arrive", () => {
    mockStoreState.registeredServers = ["github"];
    render(<AvailableTools />);
    const card = screen.getByTestId("tools-item-github");
    expect(card).toHaveAttribute("data-loading", "true");
  });

  it("replaces the loading card with the system card once the listing lands", () => {
    mockStoreState.registeredServers = ["github"];
    mockStoreState.systemTools = { github: [] };
    mockStoreState.servers.github = [
      { name: "tool3", description: "d", inputSchema: {}, enabled: true },
    ];
    render(<AvailableTools />);
    const cards = screen.getAllByTestId("tools-item-github");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-loading", "false");
    expect(cards[0]).toHaveAttribute("data-failed-text", "");
  });

  it("passes the enumeration error to the card of a failed system server", () => {
    mockStoreState.registeredServers = ["github"];
    mockStoreState.systemTools = { github: [] };
    mockStoreState.systemToolsErrors = { github: "connect ECONNREFUSED" };
    render(<AvailableTools />);
    const card = screen.getByTestId("tools-item-github");
    expect(card).toHaveAttribute("data-loading", "false");
    expect(card).toHaveAttribute("data-failed-text", "connect ECONNREFUSED");
  });

  it("does not duplicate a server listed both locally and by the system listing", () => {
    mockGetCustomServers.mockReturnValue({ github: { url: "http://x" } });
    mockStoreState.systemTools = { github: [] };
    render(<AvailableTools />);
    expect(screen.getAllByTestId("tools-item-github")).toHaveLength(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
