// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockDeleteProfile = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();

let mockIsRTL = false;

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    changeLocale: vi.fn(),
    isRTL: mockIsRTL,
    direction: mockIsRTL ? ("rtl" as const) : ("ltr" as const),
  }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useProfilesStore: () => ({
      deleteProfile: mockDeleteProfile,
    }),
  }),
}));

vi.mock("../../dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({
    children,
    header,
    onClose,
  }: {
    children: React.ReactNode;
    header?: string;
    onClose?: () => void;
    withWarningIcon?: boolean;
  }) => (
    <div data-testid="dialog-content">
      <span data-testid="dialog-header">{header}</span>
      <button data-testid="dialog-close" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  ),
  DialogOverlay: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-overlay" {...props}>
      {children}
    </div>
  ),
  DialogFooter: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-footer" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("../../button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button data-testid={`button-${variant || "primary"}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { DeleteProfileDialog } from "../DeleteProfileDialog";
import type { Profile } from "../../../../types";

const profile: Profile = {
  id: "profile-1",
  name: "Test Profile",
  providerType: "openai",
  baseUrl: "https://api.openai.com",
  key: "sk-test",
  modelId: "gpt-4",
};

describe("DeleteProfileDialog", () => {
  beforeEach(() => {
    mockDeleteProfile.mockClear();
    mockOnClose.mockClear();
    mockIsRTL = false;
  });

  it("renders the dialog with warning text", () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("WantDeleteModel")).toBeInTheDocument();
  });

  it("renders the dialog header", () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);
    expect(screen.getByTestId("dialog-header")).toHaveTextContent(
      "DeleteModel"
    );
  });

  it("calls onClose when No button is clicked", () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("No"));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("calls deleteProfile and onClose when Yes is clicked", async () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Yes"));
    });

    expect(mockDeleteProfile).toHaveBeenCalledWith("profile-1");
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("calls onSubmitAction on Enter key", async () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    expect(mockDeleteProfile).toHaveBeenCalledWith("profile-1");
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("does not trigger on non-Enter key", async () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(mockDeleteProfile).not.toHaveBeenCalled();
  });

  it("calls onClose from dialog content close handler", () => {
    render(<DeleteProfileDialog profile={profile} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId("dialog-close"));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("applies RTL layout when isRTL is true", () => {
    mockIsRTL = true;
    const { container } = render(
      <DeleteProfileDialog profile={profile} onClose={mockOnClose} />
    );
    const buttonRow = container.querySelector(".flex-row-reverse");
    expect(buttonRow).toBeTruthy();
  });

  it("applies LTR layout when isRTL is false", () => {
    mockIsRTL = false;
    const { container } = render(
      <DeleteProfileDialog profile={profile} onClose={mockOnClose} />
    );
    const buttonRow = container.querySelector(".flex-row-reverse");
    expect(buttonRow).toBeNull();
  });
});
