// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../sub-components", () => ({
  Models: () => <div data-testid="models" />,
}));

import AiModelsPage from "../index";

describe("AiModelsPage", () => {
  it("renders heading", () => {
    render(<AiModelsPage />);
    expect(screen.getByText("AIModels")).toBeInTheDocument();
  });

  it("renders Models sub-component", () => {
    render(<AiModelsPage />);
    expect(screen.getByTestId("models")).toBeInTheDocument();
  });
});
