// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGoToChat = vi.fn();

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useRouter: (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { goToChat: mockGoToChat };
      return selector ? selector(state) : state;
    },
  }),
}));

vi.mock("../../../components/model-config-cards", () => ({
  AddModelCard: ({
    variant,
    onSuccess,
  }: {
    variant?: string;
    onSuccess?: () => void;
  }) => (
    <div data-testid="add-model-card" data-variant={variant}>
      <button onClick={onSuccess}>Success</button>
    </div>
  ),
}));

import EmptyScreen from "../index";

describe("EmptyScreenPage", () => {
  it("renders AddModelCard in standalone variant", () => {
    render(<EmptyScreen />);
    const card = screen.getByTestId("add-model-card");
    expect(card).toHaveAttribute("data-variant", "standalone");
  });

  it("navigates to chat on success", () => {
    mockGoToChat.mockClear();
    render(<EmptyScreen />);
    screen.getByText("Success").click();
    expect(mockGoToChat).toHaveBeenCalledOnce();
  });
});
