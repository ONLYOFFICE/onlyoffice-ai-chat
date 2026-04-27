// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RadioButton } from "../index";

describe("RadioButton", () => {
  it("renders unchecked by default", () => {
    render(<RadioButton />);
    const input = screen.getByRole("radio");
    expect(input).not.toBeChecked();
  });

  it("renders checked when checked prop is true", () => {
    render(<RadioButton checked />);
    expect(screen.getByRole("radio")).toBeChecked();
  });

  it("calls onChange on click", () => {
    const onChange = vi.fn();
    render(<RadioButton onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<RadioButton disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders disabled input", () => {
    render(<RadioButton disabled />);
    expect(screen.getByRole("radio")).toBeDisabled();
  });
});
