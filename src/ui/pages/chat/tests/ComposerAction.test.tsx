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

vi.mock("../sub-components/ComposerActionSettings", () => ({
  ComposerActionSettings: () => <div data-testid="composer-action-settings" />,
}));

vi.mock("../sub-components/ComposerActionRoom", () => ({
  ComposerActionRoom: () => <div data-testid="composer-action-room" />,
}));

vi.mock("../sub-components/ComposerActionSend", () => ({
  ComposerActionSend: () => <div data-testid="composer-action-send" />,
}));

vi.mock("../sub-components/ComposerActionSelectModel", () => ({
  SelectModel: ({ locked }: { locked?: boolean }) => (
    <div
      data-testid="composer-action-select-model"
      data-locked={String(locked ?? false)}
    />
  ),
}));

const mockUseWidgetConfig = vi.fn();

vi.mock("../../../../widget-config", () => ({
  useWidgetConfig: () => mockUseWidgetConfig(),
}));

import { ComposerAction } from "../sub-components/ComposerAction";

function setupWidgetConfig(overrides?: {
  hideProfilePicker?: boolean;
  profilePickerReadOnly?: boolean;
  entityId?: string;
}) {
  // `hideProfilePicker` is tri-state: an omitted flag must reach the
  // component as `undefined` (fall back to the entityId heuristic), so
  // don't coerce it to `false` (which means "force-show") here.
  mockUseWidgetConfig.mockReturnValue({
    hideProfilePicker: overrides?.hideProfilePicker,
    profilePickerReadOnly: overrides?.profilePickerReadOnly,
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
    expect(screen.getByTestId("composer-action-settings")).toBeInTheDocument();
    expect(screen.getByTestId("composer-action-room")).toBeInTheDocument();
    expect(screen.getByTestId("composer-action-send")).toBeInTheDocument();
  });

  it("renders with flex layout", () => {
    const { container } = render(<ComposerAction />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("flex");
    expect(root.className).toContain("flex-col");
  });

  it("groups attachment, prompts and settings on the left", () => {
    render(<ComposerAction />);
    const attachment = screen.getByTestId("composer-action-attachment");
    const prompts = screen.getByTestId("composer-action-prompts");
    const settings = screen.getByTestId("composer-action-settings");
    expect(attachment.parentElement).toBe(prompts.parentElement);
    expect(settings.parentElement).toBe(prompts.parentElement);
    const room = screen.getByTestId("composer-action-room");
    expect(room.parentElement).toBe(prompts.parentElement);
    // The room sits right after the cog that connected it.
    expect(settings.nextElementSibling).toBe(room);
  });

  it("places send button in a separate container", () => {
    render(<ComposerAction />);
    const send = screen.getByTestId("composer-action-send");
    const attachment = screen.getByTestId("composer-action-attachment");
    expect(send.parentElement).not.toBe(attachment.parentElement);
  });

  const lockedAttr = () =>
    screen
      .getByTestId("composer-action-select-model")
      .getAttribute("data-locked");

  it("shows the model selector open by default", () => {
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("false");
  });

  it("locks (but keeps) the model selector when hideProfilePicker is true", () => {
    setupWidgetConfig({ hideProfilePicker: true });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("true");
  });

  it("locks the model selector in entity (room) mode when the flag is omitted", () => {
    setupWidgetConfig({ entityId: "e1" });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("true");
  });

  it("keeps the selector open in entity mode when hideProfilePicker is false", () => {
    setupWidgetConfig({ entityId: "e1", hideProfilePicker: false });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("false");
  });

  it("locks the selector in entity mode when hideProfilePicker is true", () => {
    setupWidgetConfig({ entityId: "e1", hideProfilePicker: true });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("true");
  });

  it("keeps the selector open when hideProfilePicker is false without entityId", () => {
    setupWidgetConfig({ hideProfilePicker: false });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("false");
  });

  it("keeps the selector open in entity mode when profilePickerReadOnly is true", () => {
    // Read-only mode means "display the profile", so it overrides the
    // entity default-lock heuristic; SelectModel renders the label itself.
    setupWidgetConfig({ entityId: "e1", profilePickerReadOnly: true });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("false");
  });

  it("locks the selector when hideProfilePicker is true despite profilePickerReadOnly", () => {
    setupWidgetConfig({ hideProfilePicker: true, profilePickerReadOnly: true });
    render(<ComposerAction />);
    expect(lockedAttr()).toBe("true");
  });
});
