// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockCopyToClipboard = vi.fn();
let mockIsCopied = false;

vi.mock("../hooks/useCopyToClipboard", () => ({
  default: () => ({
    isCopied: mockIsCopied,
    copyToClipboard: mockCopyToClipboard,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../../tooltip-icon-button", () => ({
  TooltipIconButton: ({
    children,
    onClick,
    tooltip,
    visible,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    tooltip?: string;
    visible?: boolean;
  }) => (
    <button
      data-testid="tooltip-icon-button"
      data-tooltip={tooltip}
      data-visible={String(visible)}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

vi.mock("../../icon-button", () => ({
  IconButton: ({
    iconName,
    isStroke,
    disableHover,
  }: {
    iconName: string;
    size?: number;
    isStroke?: boolean;
    disableHover?: boolean;
  }) => (
    <span
      data-testid={`icon-${iconName}`}
      data-stroke={String(!!isStroke)}
      data-disable-hover={String(!!disableHover)}
    >
      {iconName}
    </span>
  ),
}));

import CodeHeader from "../sub-components/CodeHeader";

describe("CodeHeader", () => {
  it("renders the language label", () => {
    mockIsCopied = false;
    render(<CodeHeader language="typescript" code="const x = 1;" />);
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("renders copy icon when not copied", () => {
    mockIsCopied = false;
    render(<CodeHeader language="js" code="let a = 1;" />);
    expect(screen.getByTestId("icon-btn-copy")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-checked")).not.toBeInTheDocument();
  });

  it("renders checked icon when copied", () => {
    mockIsCopied = true;
    render(<CodeHeader language="js" code="let a = 1;" />);
    expect(screen.getByTestId("icon-checked")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-btn-copy")).not.toBeInTheDocument();
  });

  it("calls copyToClipboard on click when not copied", () => {
    mockIsCopied = false;
    mockCopyToClipboard.mockClear();
    render(<CodeHeader language="js" code="const code = true;" />);
    fireEvent.click(screen.getByTestId("tooltip-icon-button"));
    expect(mockCopyToClipboard).toHaveBeenCalledWith("const code = true;");
  });

  it("does not call copyToClipboard when already copied", () => {
    mockIsCopied = true;
    mockCopyToClipboard.mockClear();
    render(<CodeHeader language="js" code="const code = true;" />);
    fireEvent.click(screen.getByTestId("tooltip-icon-button"));
    expect(mockCopyToClipboard).not.toHaveBeenCalled();
  });

  it("does not call copyToClipboard when code is empty", () => {
    mockIsCopied = false;
    mockCopyToClipboard.mockClear();
    render(<CodeHeader language="js" code="" />);
    fireEvent.click(screen.getByTestId("tooltip-icon-button"));
    expect(mockCopyToClipboard).not.toHaveBeenCalled();
  });

  it("shows CopyToClipboard tooltip", () => {
    mockIsCopied = false;
    render(<CodeHeader language="js" code="x" />);
    expect(screen.getByTestId("tooltip-icon-button")).toHaveAttribute(
      "data-tooltip",
      "CopyToClipboard"
    );
  });

  it("shows the Copied tooltip once copied", () => {
    mockIsCopied = true;
    render(<CodeHeader language="js" code="x" />);
    expect(screen.getByTestId("tooltip-icon-button")).toHaveAttribute(
      "data-tooltip",
      "Copied"
    );
  });
});
