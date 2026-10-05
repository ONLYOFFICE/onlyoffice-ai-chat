// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

// `showToast` is set per-test to exercise the host-delegation path.
const platform: {
  showToast?: (text: string, meta?: { heading?: string }) => void;
} = {};

vi.mock("../../../providers/PlatformProvider", () => ({
  usePlatform: () => platform,
  useOptionalPlatform: () => platform,
}));

vi.mock("../../icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="icon">{name}</span>,
}));

import { I18nProvider } from "../../../providers/LocalesProvider";
import { ToastProvider, useToast } from "../index";

/** Queues whatever it's handed the moment it mounts. */
const Trigger = ({
  title,
  duration,
  heading,
}: {
  title: string;
  duration?: number;
  heading?: string;
}) => {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() => showToast(title, { duration, heading })}
    >
      show
    </button>
  );
};

const renderWithProvider = (ui: React.ReactNode) =>
  render(
    <I18nProvider locale="en">
      <ToastProvider>{ui}</ToastProvider>
    </I18nProvider>
  );

describe("ToastProvider", () => {
  // The mock adapter is module-scoped, so a host toast set by one test would
  // otherwise silently divert every test after it.
  afterEach(() => {
    delete platform.showToast;
  });

  it("shows a toast once queued and not before", () => {
    renderWithProvider(<Trigger title="Prompt saved" />);

    expect(screen.queryByText("Prompt saved")).toBeNull();

    act(() => {
      screen.getByRole("button", { name: "show" }).click();
    });

    expect(screen.getByText("Prompt saved")).toBeTruthy();
  });

  // `AIChatWidget` and `ChatPage` both mount a provider, so the widget path
  // nests them. The inner one must defer to the outer rather than open a
  // second viewport, or the toast lands in a stack nobody is showing.
  it("renders a heading above the text when one is given", () => {
    renderWithProvider(
      <Trigger
        title="Web search is available in AI Chat."
        heading="API key saved."
      />
    );
    act(() => {
      screen.getByRole("button", { name: "show" }).click();
    });

    const toast = screen.getByTestId("toast");
    expect(toast.textContent).toContain(
      "API key saved.Web search is available in AI Chat."
    );
  });

  it("renders a single toast when providers are nested", () => {
    render(
      <I18nProvider locale="en">
        <ToastProvider>
          <ToastProvider>
            <Trigger title="Prompt saved" />
          </ToastProvider>
        </ToastProvider>
      </I18nProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "show" }).click();
    });

    expect(screen.getAllByText("Prompt saved")).toHaveLength(1);
  });

  it("stacks several toasts at once", () => {
    renderWithProvider(
      <>
        <Trigger title="first" />
        <Trigger title="second" />
      </>
    );

    const [first, second] = screen.getAllByRole("button", { name: "show" });
    act(() => {
      first.click();
      second.click();
    });

    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
  });

  it("closes a toast from its close button", () => {
    renderWithProvider(<Trigger title="Prompt saved" />);
    act(() => {
      screen.getByRole("button", { name: "show" }).click();
    });

    act(() => {
      screen.getByRole("button", { name: "Close" }).click();
    });

    // As with the timer, jsdom never fires the exit animation that unmounts it.
    const toast = screen.queryByText("Prompt saved")?.closest("li");
    expect(toast?.getAttribute("data-state")).not.toBe("open");
  });

  it("closes a toast once its duration elapses", () => {
    vi.useFakeTimers();
    try {
      renderWithProvider(<Trigger title="Prompt saved" duration={1000} />);

      act(() => {
        screen.getByRole("button", { name: "show" }).click();
      });
      expect(screen.getByText("Prompt saved")).toBeTruthy();

      // Radix closes on its own timer; the element is only unmounted after the
      // exit animation, which jsdom never fires — so assert it is no longer
      // reported as open rather than that it is gone.
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      const toast = screen.queryByText("Prompt saved")?.closest("li");
      expect(toast?.getAttribute("data-state")).not.toBe("open");
    } finally {
      vi.useRealTimers();
    }
  });

  it("useToast is a no-op without a provider rather than throwing", () => {
    // A host may render a single page outside the widget shell; a save there
    // must still go through instead of crashing on a missing viewport.
    expect(() =>
      render(
        <I18nProvider locale="en">
          <Trigger title="Prompt saved" />
        </I18nProvider>
      )
    ).not.toThrow();

    act(() => {
      screen.getByRole("button", { name: "show" }).click();
    });
    expect(screen.queryByText("Prompt saved")).toBeNull();
  });

  describe("host delegation", () => {
    it("hands the toast to the host adapter instead of rendering its own", () => {
      const hostToast = vi.fn();
      platform.showToast = hostToast;

      renderWithProvider(<Trigger title="Prompt saved" />);
      act(() => {
        screen.getByRole("button", { name: "show" }).click();
      });

      expect(hostToast).toHaveBeenCalledWith("Prompt saved");
      // The host owns the notification, so the built-in stack stays empty —
      // otherwise the user would see the same message twice.
      expect(screen.queryByText("Prompt saved")).toBeNull();
    });

    it("passes the heading to the host as its toast title", () => {
      const hostToast = vi.fn();
      platform.showToast = hostToast;

      renderWithProvider(
        <Trigger
          title="Web search is available in AI Chat."
          heading="API key saved."
        />
      );
      act(() => {
        screen.getByRole("button", { name: "show" }).click();
      });

      expect(hostToast).toHaveBeenCalledWith(
        "Web search is available in AI Chat.",
        { heading: "API key saved." }
      );
    });

    it("keeps a non-string title in the built-in stack", () => {
      const hostToast = vi.fn();
      platform.showToast = hostToast;

      const MarkedUpTrigger = () => {
        const { showToast } = useToast();
        return (
          <button type="button" onClick={() => showToast(<b>Prompt saved</b>)}>
            show
          </button>
        );
      };

      renderWithProvider(<MarkedUpTrigger />);
      act(() => {
        screen.getByRole("button", { name: "show" }).click();
      });

      // The host slot only takes a string; stringifying markup would render
      // "[object Object]", so this one falls back to the built-in stack.
      expect(hostToast).not.toHaveBeenCalled();
      expect(screen.getByText("Prompt saved")).toBeTruthy();
    });

    it("delegates without a provider, since the host owns the viewport", () => {
      const hostToast = vi.fn();
      platform.showToast = hostToast;

      render(
        <I18nProvider locale="en">
          <Trigger title="Prompt saved" />
        </I18nProvider>
      );
      act(() => {
        screen.getByRole("button", { name: "show" }).click();
      });

      expect(hostToast).toHaveBeenCalledWith("Prompt saved");
    });
  });
});
