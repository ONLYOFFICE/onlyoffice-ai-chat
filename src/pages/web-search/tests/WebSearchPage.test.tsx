// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../sub-components", () => ({
  WebSearch: ({ variant }: { variant?: string }) => (
    <div data-testid="web-search" data-variant={variant} />
  ),
}));

import WebSearchPage from "../index";

describe("WebSearchPage", () => {
  it("renders heading", () => {
    render(<WebSearchPage />);
    expect(screen.getByText("WebSearch")).toBeInTheDocument();
  });

  it("renders WebSearch with variant=page", () => {
    render(<WebSearchPage />);
    const ws = screen.getByTestId("web-search");
    expect(ws).toHaveAttribute("data-variant", "page");
  });
});
