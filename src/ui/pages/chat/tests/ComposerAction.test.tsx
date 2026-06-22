// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../sub-components/ComposerActionAttachments", () => ({
  ComposerActionAttachment: () => (
    <div data-testid="composer-action-attachment" />
  ),
}));

vi.mock("../sub-components/ComposerActionPrompts", () => ({
  ComposerActionPrompts: () => <div data-testid="composer-action-prompts" />,
}));

vi.mock("../sub-components/ComposerActionSend", () => ({
  ComposerActionSend: () => <div data-testid="composer-action-send" />,
}));

vi.mock("../sub-components/ComposerActionSelectModel", () => ({
  SelectModel: () => <div data-testid="composer-action-select-model" />,
}));

const mockUseWidgetConfig = vi.fn();

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

import { ComposerAction } from "../sub-components/ComposerAction";

function setupWidgetConfig(overrides?: {
  hideProfilePicker?: boolean;
  entityId?: string;
}) {
  mockUseWidgetConfig.mockReturnValue({
    hideProfilePicker: overrides?.hideProfilePicker ?? false,
    entityId: overrides?.entityId,
  });
}

describe("ComposerAction", () => {
  beforeEach(() => {
    setupWidgetConfig();
  });

  it("renders all three sub-components", () => {
    render(<ComposerAction />);
    expect(
      screen.getByTestId("composer-action-attachment")
    ).toBeInTheDocument();
    expect(screen.getByTestId("composer-action-prompts")).toBeInTheDocument();
    expect(screen.getByTestId("composer-action-send")).toBeInTheDocument();
  });

  it("renders with flex layout", () => {
    const { container } = render(<ComposerAction />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("flex");
    expect(root.className).toContain("flex-col");
  });

  it("groups attachment and prompts on the left", () => {
    render(<ComposerAction />);
    const attachment = screen.getByTestId("composer-action-attachment");
    const prompts = screen.getByTestId("composer-action-prompts");
    expect(attachment.parentElement).toBe(prompts.parentElement);
  });

  it("places send button in a separate container", () => {
    render(<ComposerAction />);
    const send = screen.getByTestId("composer-action-send");
    const attachment = screen.getByTestId("composer-action-attachment");
    expect(send.parentElement).not.toBe(attachment.parentElement);
  });

  it("shows the model selector by default", () => {
    render(<ComposerAction />);
    expect(
      screen.getByTestId("composer-action-select-model")
    ).toBeInTheDocument();
  });

  it("hides the model selector when hideProfilePicker is true", () => {
    setupWidgetConfig({ hideProfilePicker: true });
    render(<ComposerAction />);
    expect(
      screen.queryByTestId("composer-action-select-model")
    ).not.toBeInTheDocument();
  });

  it("hides the model selector in entity (room) mode", () => {
    setupWidgetConfig({ entityId: "e1" });
    render(<ComposerAction />);
    expect(
      screen.queryByTestId("composer-action-select-model")
    ).not.toBeInTheDocument();
  });
});
