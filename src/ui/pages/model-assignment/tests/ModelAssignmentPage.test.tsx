// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../sub-components", () => ({
  ModelAssignment: () => <div data-testid="model-assignment" />,
}));

vi.mock("../../../hooks/useEnsureProfiles", () => ({
  default: () => {},
}));

import ModelAssignmentPage from "../index";

describe("ModelAssignmentPage", () => {
  it("renders heading", () => {
    render(<ModelAssignmentPage />);
    expect(screen.getByText("ModelAssignment")).toBeInTheDocument();
  });

  it("renders ModelAssignment sub-component", () => {
    render(<ModelAssignmentPage />);
    expect(screen.getByTestId("model-assignment")).toBeInTheDocument();
  });
});
