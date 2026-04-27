// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

import { Input } from "../index";

describe("Input", () => {
  it("renders a text input by default", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("applies placeholder", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("fires onChange", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hi" },
    });
    expect(onChange).toHaveBeenCalled();
  });

  it("renders icon when icon prop is provided", () => {
    render(<Input icon="search" />);
    expect(screen.getByTestId("icon")).toHaveTextContent("search");
  });

  it("applies error border style", () => {
    const { container } = render(<Input isError />);
    const input = container.querySelector("input");
    expect(input?.style.border).toContain("var(--input-error-color)");
  });

  it("shows clear button for search input with value", () => {
    render(<Input type="search" value="query" onClear={vi.fn()} readOnly />);
    const clearBtn = screen.getByRole("button");
    expect(clearBtn).toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    render(<Input type="search" value="query" onClear={onClear} readOnly />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("does not show clear button when search has no value", () => {
    render(<Input type="search" value="" readOnly />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("can be disabled", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
