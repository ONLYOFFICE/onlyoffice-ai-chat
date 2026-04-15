// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: (selector?: (s: unknown) => unknown) => {
      const state = { profiles: [{ id: "p1" }] };
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

import Settings from "../index";

describe("SettingsPage", () => {
  it("renders settings header", () => {
    render(<Settings />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders all 4 tab labels", () => {
    render(<Settings />);
    expect(screen.getByText("AIModels")).toBeInTheDocument();
    expect(screen.getByText("ModelAssignment")).toBeInTheDocument();
    expect(screen.getByText("MCPServers")).toBeInTheDocument();
    expect(screen.getByText("WebSearch")).toBeInTheDocument();
  });

  it("shows AI Models content by default", () => {
    render(<Settings />);
    expect(screen.getByTestId("models")).toBeInTheDocument();
  });
});
