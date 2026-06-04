// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetMcpConfigDirty = vi.fn();
// Toggled per-test to simulate unsaved MCP edits.
let mcpConfigDirty = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: (selector?: (s: unknown) => unknown) => {
      const state = { profiles: [{ id: "p1" }] };
      return selector ? selector(state) : state;
    },
    useServersStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        mcpConfigDirty,
        setMcpConfigDirty: mockSetMcpConfigDirty,
      };
      return selector ? selector(state) : state;
    },
  }),
}));

vi.mock("../../ai-models/sub-components", () => ({
  Models: () => <div data-testid="models" />,
}));

vi.mock("../../model-assignment/sub-components", () => ({
  ModelAssignment: () => <div data-testid="model-assignment" />,
}));

vi.mock("../../mcp-servers/sub-components", () => ({
  Servers: () => <div data-testid="servers" />,
}));

vi.mock("../../web-search/sub-components", () => ({
  WebSearch: () => <div data-testid="web-search" />,
}));

vi.mock("../../../hooks/useEnsureProfiles", () => ({
  default: () => {},
}));
vi.mock("../../../hooks/useEnsureTools", () => ({
  default: () => {},
}));

import Settings from "../index";
import { WidgetConfigProvider } from "../../../../widget-config";

describe("SettingsPage", () => {
  it("renders settings header", () => {
    render(<Settings />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders all 4 tab labels", () => {
    render(<Settings />);
    // tab triggers use role="tab"; the AI Models page also renders an h1 with
    // the same text ("AIModels"), so disambiguate by role here.
    expect(screen.getByRole("tab", { name: "AIModels" })).toBeInTheDocument();
    expect(screen.getByText("ModelAssignment")).toBeInTheDocument();
    expect(screen.getByText("MCPServers")).toBeInTheDocument();
    expect(screen.getByText("WebSearch")).toBeInTheDocument();
  });

  it("shows AI Models content by default", () => {
    render(<Settings />);
    expect(screen.getByTestId("models")).toBeInTheDocument();
  });

  describe("leaving the MCP tab with unsaved changes", () => {
    it("stays on the MCP tab when discard is declined", async () => {
      mcpConfigDirty = true;
      const user = userEvent.setup();
      const onDiscardMcpChanges = vi.fn().mockResolvedValue(false);
      render(
        <WidgetConfigProvider config={{ onDiscardMcpChanges }}>
          <Settings />
        </WidgetConfigProvider>
      );

      await user.click(screen.getByRole("tab", { name: "MCPServers" }));
      await waitFor(() =>
        expect(screen.getByTestId("servers")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("tab", { name: "WebSearch" }));

      await waitFor(() => expect(onDiscardMcpChanges).toHaveBeenCalled());
      // Still on MCP — navigation was cancelled.
      expect(screen.getByTestId("servers")).toBeInTheDocument();
      expect(screen.queryByTestId("web-search")).not.toBeInTheDocument();
    });

    it("leaves the MCP tab when discard is confirmed", async () => {
      mcpConfigDirty = true;
      const user = userEvent.setup();
      const onDiscardMcpChanges = vi.fn().mockResolvedValue(true);
      render(
        <WidgetConfigProvider config={{ onDiscardMcpChanges }}>
          <Settings />
        </WidgetConfigProvider>
      );

      await user.click(screen.getByRole("tab", { name: "MCPServers" }));
      await user.click(screen.getByRole("tab", { name: "WebSearch" }));

      await waitFor(() => expect(onDiscardMcpChanges).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByTestId("web-search")).toBeInTheDocument()
      );
    });

    it("does not prompt when the config is not dirty", async () => {
      mcpConfigDirty = false;
      const user = userEvent.setup();
      const onDiscardMcpChanges = vi.fn().mockResolvedValue(false);
      render(
        <WidgetConfigProvider config={{ onDiscardMcpChanges }}>
          <Settings />
        </WidgetConfigProvider>
      );

      await user.click(screen.getByRole("tab", { name: "MCPServers" }));
      await user.click(screen.getByRole("tab", { name: "WebSearch" }));

      await waitFor(() =>
        expect(screen.getByTestId("web-search")).toBeInTheDocument()
      );
      expect(onDiscardMcpChanges).not.toHaveBeenCalled();
    });
  });
});
