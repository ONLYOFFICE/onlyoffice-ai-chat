// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

// The real DropdownMenu on purpose: what is under test is the Radix modality
// this combobox asks for, which a mocked menu would hide.
import { ComboBox } from "../index";

const twoComboBoxes = (
  <>
    <ComboBox
      data-testid="combo-a"
      value="A"
      items={[{ text: "a-option", onClick: vi.fn() }]}
    />
    <ComboBox
      data-testid="combo-b"
      value="B"
      items={[{ text: "b-option", onClick: vi.fn() }]}
    />
  </>
);

describe("ComboBox modality", () => {
  it("leaves the rest of the page clickable while open", async () => {
    const user = userEvent.setup();
    render(twoComboBoxes);

    await user.click(screen.getByTestId("combo-a"));
    expect(screen.getByText("a-option")).toBeInTheDocument();

    // A modal Radix menu parks `pointer-events: none` here, which is what made
    // a click on the next combobox land on nothing.
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("hands over to the next combobox in a single click", async () => {
    // The default pointer-events check is the assertion: userEvent refuses to
    // click an element the browser could not have delivered the click to.
    const user = userEvent.setup();
    render(twoComboBoxes);

    await user.click(screen.getByTestId("combo-a"));
    expect(screen.getByText("a-option")).toBeInTheDocument();

    await user.click(screen.getByTestId("combo-b"));

    expect(screen.queryByText("a-option")).not.toBeInTheDocument();
    expect(screen.getByText("b-option")).toBeInTheDocument();
  });
});
