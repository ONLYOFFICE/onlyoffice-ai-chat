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

  it("applies error border style on the container", () => {
    const { container } = render(<Input isError />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.border).toContain("var(--input-error-color)");
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

  it("hides the end-anchored icon once a search value is present (default)", () => {
    render(
      <Input
        type="search"
        icon="search"
        value="query"
        onClear={vi.fn()}
        readOnly
      />
    );
    // Default iconPosition="end": the magnifier yields to the clear button.
    expect(screen.queryByText("search")).toBeNull();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("keeps a start-anchored icon visible while the clear button shows at the end", () => {
    render(
      <Input
        type="search"
        icon="search"
        iconPosition="start"
        value="query"
        onClear={vi.fn()}
        readOnly
      />
    );
    const icon = screen.getByText("search");
    const input = screen.getByRole("searchbox");
    const clearBtn = screen.getByRole("button");
    // Both the magnifier and the clear button are present at once.
    expect(icon).toBeInTheDocument();
    expect(clearBtn).toBeInTheDocument();
    // Icon precedes the input (start edge); the clear button follows it (end).
    expect(
      icon.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      input.compareDocumentPosition(clearBtn) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders a start-anchored icon before the input even with no value", () => {
    render(<Input type="search" icon="search" iconPosition="start" readOnly />);
    const icon = screen.getByText("search");
    const input = screen.getByRole("searchbox");
    expect(
      icon.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("toggles a password input between masked and revealed", () => {
    const { container } = render(
      <Input type="password" value="secret" readOnly />
    );
    const input = container.querySelector("input")!;
    const toggle = screen.getByTestId("input-password-toggle");

    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveTextContent("eye.closed");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveTextContent(/^eye$/);

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("does not render the password toggle for other input types", () => {
    render(<Input />);
    expect(screen.queryByTestId("input-password-toggle")).toBeNull();
  });

  it("disables the password toggle with the input", () => {
    render(<Input type="password" disabled />);
    expect(screen.getByTestId("input-password-toggle")).toBeDisabled();
  });
});
