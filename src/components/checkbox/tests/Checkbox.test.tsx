// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

import { Checkbox } from "../index";

describe("Checkbox", () => {
  it("renders unchecked by default", () => {
    render(<Checkbox />);
    const input = screen.getByRole("checkbox");
    expect(input).not.toBeChecked();
  });

  it("renders checked when checked prop is true", () => {
    render(<Checkbox checked />);
    const input = screen.getByRole("checkbox");
    expect(input).toBeChecked();
  });

  it("shows check icon when checked", () => {
    render(<Checkbox checked />);
    expect(screen.getByTestId("icon")).toHaveTextContent("checked");
  });

  it("does not show check icon when unchecked", () => {
    render(<Checkbox />);
    expect(screen.queryByTestId("icon")).toBeNull();
  });

  it("calls onChange on click", () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Checkbox disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders with custom id", () => {
    render(<Checkbox id="my-cb" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("id", "my-cb");
  });
});
