// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../icon", () => ({
  Icon: ({ name, size }: { name: string; size?: number }) => (
    <span data-testid="icon" data-name={name} data-size={size} />
  ),
}));

import { IconButton } from "../index";

describe("IconButton", () => {
  it("renders a button with icon", () => {
    render(<IconButton iconName="close" size={24} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toHaveAttribute("data-name", "close");
  });

  it("applies size as inline style", () => {
    render(<IconButton iconName="edit" size={32} />);
    const btn = screen.getByRole("button");
    expect(btn.style.width).toBe("32px");
    expect(btn.style.height).toBe("32px");
    expect(btn.style.minWidth).toBe("32px");
  });

  it("fires click handler", () => {
    const onClick = vi.fn();
    render(<IconButton iconName="add" size={20} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can be disabled", () => {
    render(<IconButton iconName="x" size={20} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies active background style", () => {
    render(<IconButton iconName="menu" size={20} isActive />);
    const btn = screen.getByRole("button");
    expect(btn.style.backgroundColor).toBeTruthy();
  });

  it("applies custom className", () => {
    render(<IconButton iconName="x" size={20} className="extra" />);
    expect(screen.getByRole("button")).toHaveClass("extra");
  });
});
