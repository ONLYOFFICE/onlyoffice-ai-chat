// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../../components/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    header,
    onClose,
    withWarningIcon,
  }: {
    children: React.ReactNode;
    header?: string;
    onClose?: () => void;
    className?: string;
    withWarningIcon?: boolean;
  }) => (
    <div
      data-testid="dialog-content"
      data-header={header}
      data-warning={withWarningIcon}
    >
      <button data-testid="dialog-close" onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  ),
  DialogOverlay: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-overlay">{children}</div>
  ),
  DialogFooter: ({
    cancelLabel,
    onCancel,
    submitLabel,
    onSubmit,
    submitDisabled,
  }: {
    cancelLabel: string;
    onCancel?: () => void;
    submitLabel: string;
    onSubmit?: () => void;
    submitDisabled?: boolean;
  }) => (
    <div data-testid="dialog-footer">
      <button data-testid="dialog-cancel" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        data-testid="dialog-submit"
        onClick={onSubmit}
        disabled={submitDisabled}
      >
        {submitLabel}
      </button>
    </div>
  ),
}));

import { ConnectRoomDialog } from "../sub-components/ConnectRoomDialog";

const room = { id: "r1", name: "Vacations" };

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConnectRoomDialog
      cloud="nct2.onlyoffice.com"
      room={room}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
  return { onConfirm, onClose };
};

describe("ConnectRoomDialog", () => {
  it("opens with the connect title and no warning icon", () => {
    renderDialog();
    expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe("true");
    const content = screen.getByTestId("dialog-content");
    expect(content.getAttribute("data-header")).toBe("ConnectRoomTitle");
    expect(content.getAttribute("data-warning")).toBeNull();
  });

  it("shows the room name, its source cloud and the description", () => {
    renderDialog();
    expect(screen.getByTestId("connect-room-name").textContent).toBe(
      "Vacations"
    );
    expect(screen.getByTestId("connect-room-source").textContent).toBe(
      "nct2.onlyoffice.com"
    );
    expect(
      screen.getByText("ConnectRoomSource:", { exact: false })
    ).toBeTruthy();
    expect(screen.getByText("ConnectRoomDescription")).toBeInTheDocument();
  });

  it("labels the buttons Cancel and Connect, Connect enabled", () => {
    renderDialog();
    expect(screen.getByTestId("dialog-cancel").textContent).toBe("Cancel");
    const submit = screen.getByTestId("dialog-submit");
    expect(submit.textContent).toBe("Connect");
    expect(submit).not.toBeDisabled();
  });

  it("Connect confirms and then closes", () => {
    const { onConfirm, onClose } = renderDialog();
    fireEvent.click(screen.getByTestId("dialog-submit"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0]
    );
  });

  it("Cancel only closes", () => {
    const { onConfirm, onClose } = renderDialog();
    fireEvent.click(screen.getByTestId("dialog-cancel"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the header close button only closes", () => {
    const { onConfirm, onClose } = renderDialog();
    fireEvent.click(screen.getByTestId("dialog-close"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter inside the body confirms", () => {
    const { onConfirm, onClose } = renderDialog();
    fireEvent.keyDown(screen.getByTestId("connect-room-name"), {
      key: "Enter",
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter on the Cancel button does not connect", () => {
    const { onConfirm } = renderDialog();
    fireEvent.keyDown(screen.getByTestId("dialog-cancel"), { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("other keys do nothing", () => {
    const { onConfirm, onClose } = renderDialog();
    fireEvent.keyDown(screen.getByTestId("connect-room-name"), {
      key: "Escape",
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
