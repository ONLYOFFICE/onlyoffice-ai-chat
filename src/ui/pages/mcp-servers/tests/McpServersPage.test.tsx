// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../sub-components", () => ({
  Servers: ({ variant }: { variant?: string }) => (
    <div data-testid="servers" data-variant={variant} />
  ),
}));

vi.mock("../../../hooks/useEnsureTools", () => ({
  default: () => {},
}));

import McpServersPage from "../index";

describe("McpServersPage", () => {
  it("renders heading", () => {
    render(<McpServersPage />);
    expect(screen.getByText("MCPServers")).toBeInTheDocument();
  });

  it("renders Servers with variant=page", () => {
    render(<McpServersPage />);
    const servers = screen.getByTestId("servers");
    expect(servers).toHaveAttribute("data-variant", "page");
  });
});
