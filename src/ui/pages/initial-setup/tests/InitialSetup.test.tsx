// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: () => ({
      profiles: [{ id: "p1", name: "GPT-4", providerType: "openai" }],
    }),
  }),
}));

vi.mock("../../../components/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("../../../components/model-card", () => ({
  ModelCard: ({ profile }: { profile: { name: string } }) => (
    <div data-testid="model-card">{profile.name}</div>
  ),
}));

vi.mock("../../../components/model-config-cards", () => ({
  AddModelCard: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-model-card">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import InitialSetup from "../index";

describe("InitialSetupPage", () => {
  it("renders heading", () => {
    render(<InitialSetup />);
    expect(screen.getByText("AIModels")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<InitialSetup />);
    expect(screen.getByText("AIModelsDescription")).toBeInTheDocument();
  });

  it("renders Add Model button initially", () => {
    render(<InitialSetup />);
    expect(screen.getByText("AddModel")).toBeInTheDocument();
  });

  it("shows AddModelCard when Add button is clicked", () => {
    render(<InitialSetup />);
    fireEvent.click(screen.getByText("AddModel"));
    expect(screen.getByTestId("add-model-card")).toBeInTheDocument();
  });

  it("renders existing profiles as ModelCards", () => {
    render(<InitialSetup />);
    expect(screen.getByTestId("model-card")).toHaveTextContent("GPT-4");
  });

  it("closes AddModelCard when onClose is called", () => {
    render(<InitialSetup />);
    fireEvent.click(screen.getByText("AddModel"));
    expect(screen.getByTestId("add-model-card")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("add-model-card")).not.toBeInTheDocument();
  });
});
