// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../../hooks/useDirection", () => ({
  useDirection: () => ({ isRTL: false, direction: "ltr" }),
}));

import { Tabs } from "../index";

const items = [
  { value: "tab1", label: "Tab 1", content: <div>Content 1</div> },
  { value: "tab2", label: "Tab 2", content: <div>Content 2</div> },
  {
    value: "tab3",
    label: "Tab 3",
    content: <div>Content 3</div>,
    disabled: true,
  },
];

describe("Tabs", () => {
  it("renders all tab triggers", () => {
    render(<Tabs items={items} />);
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Tab 3")).toBeInTheDocument();
  });

  it("shows first tab content by default", () => {
    render(<Tabs items={items} />);
    expect(screen.getByText("Content 1")).toBeInTheDocument();
  });

  it("renders content for default tab", () => {
    render(<Tabs items={items} defaultValue="tab2" />);
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("respects controlled value", () => {
    render(<Tabs items={items} value="tab2" />);
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("renders disabled tab", () => {
    render(<Tabs items={items} />);
    const tab3 = screen.getByText("Tab 3");
    expect(tab3).toBeDisabled();
  });
});
