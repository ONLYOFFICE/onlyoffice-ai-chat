// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToggleButton } from "../index";

describe("ToggleButton", () => {
  it("renders unchecked switch", () => {
    render(<ToggleButton checked={false} onCheckedChange={vi.fn()} />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("data-state", "unchecked");
  });

  it("renders checked switch", () => {
    render(<ToggleButton checked onCheckedChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });

  it("calls onCheckedChange on click", () => {
    const onChange = vi.fn();
    render(<ToggleButton checked={false} onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not call onCheckedChange when disabled", () => {
    const onChange = vi.fn();
    render(
      <ToggleButton checked={false} onCheckedChange={onChange} disabled />
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders disabled state", () => {
    render(<ToggleButton checked={false} onCheckedChange={vi.fn()} disabled />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
