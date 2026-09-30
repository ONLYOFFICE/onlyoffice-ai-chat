// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HelpButton } from "../index";

vi.mock("../../../providers/ThemeProvider", () => ({
  useTheme: () => ({ portalContainer: null }),
}));

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({ isRTL: false, direction: "ltr" }),
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

beforeAll(() => {
  // Radix positions the popover with ResizeObserver, absent in jsdom.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const getTrigger = () => screen.getByRole("button");

describe("HelpButton", () => {
  it("renders the trigger icon and keeps the popover closed initially", () => {
    render(<HelpButton content="Hint body" />);

    expect(screen.getByTestId("icon")).toHaveTextContent("btn-menu-about");
    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();
  });

  it("opens and closes on trigger clicks", () => {
    render(<HelpButton content="Hint body" />);

    fireEvent.click(getTrigger());
    expect(screen.getAllByText("Hint body").length).toBeGreaterThan(0);

    fireEvent.click(getTrigger());
    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();
  });

  it("closes when anything around it scrolls, not when its own content does", () => {
    render(
      <div data-testid="list" style={{ overflow: "auto" }}>
        <HelpButton content={<div data-testid="body">Hint body</div>} />
      </div>
    );

    fireEvent.click(getTrigger());
    // A scroll inside the popover is the reader's.
    fireEvent.scroll(screen.getAllByTestId("body")[0]);
    expect(screen.getAllByText("Hint body").length).toBeGreaterThan(0);

    // The list the trigger sits in scrolls: the popover goes.
    fireEvent.scroll(screen.getByTestId("list"));
    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<HelpButton content="Hint body" />);

    fireEvent.click(getTrigger());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();
  });

  it("closes on an outside press but not on a press on the trigger", async () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <HelpButton content="Hint body" />
      </div>
    );

    fireEvent.click(getTrigger());
    // Radix arms the outside-press listener a tick after the layer mounts.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    fireEvent.pointerDown(getTrigger());
    expect(screen.getAllByText("Hint body").length).toBeGreaterThan(0);

    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();
  });

  it("keeps interactive content inside the popover clickable", () => {
    const onClick = vi.fn();
    render(
      <HelpButton
        aria-label="Help"
        content={
          <button type="button" onClick={onClick}>
            Download template
          </button>
        }
      />
    );

    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByText("Download template"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Download template")).toBeInTheDocument();
  });

  it("honours the controlled open state and reports changes", () => {
    const onOpenChange = vi.fn();
    render(
      <HelpButton
        content="Hint body"
        open={false}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();

    fireEvent.click(getTrigger());

    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Still closed: the parent owns the state.
    expect(screen.queryByText("Hint body")).not.toBeInTheDocument();
  });

  it("respects defaultOpen in uncontrolled mode", () => {
    render(<HelpButton content="Hint body" defaultOpen />);

    expect(screen.getAllByText("Hint body").length).toBeGreaterThan(0);
  });
});
