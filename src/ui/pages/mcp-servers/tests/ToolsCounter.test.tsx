// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseServersStore = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useServersStore: () => mockUseServersStore(),
  }),
}));

vi.mock("../../../../config", () => ({
  MAX_TOOL_COUNT: 100,
  MAX_TOOL_COUNT_WITH_WEB_SEARCH: 102,
}));

import ToolsCounter from "../sub-components/ToolsCounter";

describe("ToolsCounter", () => {
  it("renders nothing when tool count is below threshold (90)", () => {
    mockUseServersStore.mockReturnValue({
      tools: new Array(50),
      webSearchEnabled: false,
    });
    const { container } = render(<ToolsCounter />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when tool count is exactly at threshold (90)", () => {
    mockUseServersStore.mockReturnValue({
      tools: new Array(90),
      webSearchEnabled: false,
    });
    const { container } = render(<ToolsCounter />);
    expect(container.innerHTML).toBe("");
  });

  it("renders count when tool count exceeds threshold", () => {
    mockUseServersStore.mockReturnValue({
      tools: new Array(91),
      webSearchEnabled: false,
    });
    render(<ToolsCounter />);
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
    expect(screen.getByText(/Tools/)).toBeInTheDocument();
  });

  it("adjusts count for web search enabled (subtracts 2 from tools length)", () => {
    mockUseServersStore.mockReturnValue({
      tools: new Array(95),
      webSearchEnabled: true,
    });
    render(<ToolsCounter />);
    // allToolsCount = 95 - 2 = 93, maxCount = 102 - 2 = 100
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
  });

  it("renders nothing when web search enabled and adjusted count is below threshold", () => {
    mockUseServersStore.mockReturnValue({
      tools: new Array(92),
      webSearchEnabled: true,
    });
    // allToolsCount = 92 - 2 = 90, which is <= 90
    const { container } = render(<ToolsCounter />);
    expect(container.innerHTML).toBe("");
  });
});
