// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
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

import { ComposerAction } from "../sub-components/ComposerAction";

describe("ComposerAction", () => {
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
});
