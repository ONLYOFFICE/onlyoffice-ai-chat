// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        profiles: [{ id: "p1", name: "GPT-4", providerType: "openai" }],
      };
      return typeof selector === "function" ? selector(state) : state;
    },
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

const mockUseWidgetConfig = vi.fn();

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

vi.mock("../../../components/model-config-cards", () => ({
  AddModelCard: ({
    variant,
    isHorizontal,
  }: {
    variant?: string;
    isHorizontal?: boolean;
  }) => (
    <div
      data-testid="add-model-card"
      data-variant={variant}
      data-horizontal={String(isHorizontal)}
    />
  ),
}));

import InitialSetup from "../index";

describe("InitialSetupPage", () => {
  beforeEach(() => {
    mockUseWidgetConfig.mockReturnValue({});
  });

  it("always renders the standalone AddModelCard", () => {
    render(<InitialSetup />);
    const card = screen.getByTestId("add-model-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-variant", "standalone");
  });

  it("defaults AddModelCard to horizontal layout", () => {
    render(<InitialSetup />);
    expect(screen.getByTestId("add-model-card")).toHaveAttribute(
      "data-horizontal",
      "true"
    );
  });

  it("respects isAddModelCardHorizontal from widget config", () => {
    mockUseWidgetConfig.mockReturnValue({ isAddModelCardHorizontal: false });
    render(<InitialSetup />);
    expect(screen.getByTestId("add-model-card")).toHaveAttribute(
      "data-horizontal",
      "false"
    );
  });

  it("renders existing profiles as ModelCards", () => {
    render(<InitialSetup />);
    expect(screen.getByTestId("model-card")).toHaveTextContent("GPT-4");
  });
});
