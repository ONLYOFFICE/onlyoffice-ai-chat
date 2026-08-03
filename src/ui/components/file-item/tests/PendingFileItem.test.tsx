// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    changeLocale: vi.fn(),
    isRTL: false,
    direction: "ltr" as const,
  }),
}));

vi.mock("../../../providers/ComponentsProvider", () => ({
  useComponents: () => ({
    Loader: ({ size }: { size?: number }) => (
      <span data-testid="loader" data-size={size} />
    ),
  }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({
    iconName,
    onClick,
  }: {
    iconName: string;
    onClick?: () => void;
  }) => (
    <button data-testid={`icon-btn-${iconName}`} onClick={onClick}>
      {iconName}
    </button>
  ),
}));

import { PendingFileItem } from "../PendingFileItem";
import type { TPendingAttachment } from "../../../store/create-attachments-store";

const item: TPendingAttachment = {
  id: "pnd-1",
  title: "report.docx",
  kind: "file",
  type: 1,
};

describe("PendingFileItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the name/extension split and a busy status", () => {
    render(<PendingFileItem item={item} />);
    const chip = screen.getByTestId("pending-file-item");
    expect(chip).toHaveAttribute("aria-busy");
    expect(chip).toHaveAttribute("role", "status");
    expect(chip.textContent).toContain("report");
    expect(chip.textContent).toContain(".docx");
  });

  it("shows an indeterminate spinner by default", () => {
    render(<PendingFileItem item={item} />);
    expect(screen.getByTestId("loader")).toBeInTheDocument();
    expect(
      screen.queryByTestId("icon-btn-btn-close.small")
    ).not.toBeInTheDocument();
  });

  it("swaps the spinner for a cancel button on hover and reports the id", () => {
    const onCancel = vi.fn();
    render(<PendingFileItem item={item} onCancel={onCancel} />);
    const chip = screen.getByTestId("pending-file-item");
    fireEvent.mouseEnter(chip);
    expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("icon-btn-btn-close.small"));
    expect(onCancel).toHaveBeenCalledWith("pnd-1");
    fireEvent.mouseLeave(chip);
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("stays non-dismissible without onCancel", () => {
    render(<PendingFileItem item={item} />);
    const chip = screen.getByTestId("pending-file-item");
    fireEvent.mouseEnter(chip);
    expect(
      screen.queryByTestId("icon-btn-btn-close.small")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });
});
