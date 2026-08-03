// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@assistant-ui/react", () => ({
  ThreadPrimitive: {
    Empty: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="thread-empty">{children}</div>
    ),
  },
}));

import { ThreadWelcome } from "../sub-components/Welcome";
import {
  WidgetConfigProvider,
  type WidgetConfig,
} from "../../../../widget-config";

// The welcome screen is opt-in (`showWelcome`), so render it through a config
// provider that enables it plus any per-test overrides.
const renderWelcome = (config: WidgetConfig = {}) =>
  render(
    <WidgetConfigProvider config={{ showWelcome: true, ...config }}>
      <ThreadWelcome />
    </WidgetConfigProvider>
  );

describe("ThreadWelcome", () => {
  it("renders nothing unless showWelcome is set", () => {
    const { container } = render(
      <WidgetConfigProvider config={{}}>
        <ThreadWelcome />
      </WidgetConfigProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders welcome title and description", () => {
    renderWelcome();
    expect(screen.getByText("WelcomeTitle")).toBeInTheDocument();
    expect(screen.getByText("WelcomeDescription")).toBeInTheDocument();
  });

  it("wraps content in ThreadPrimitive.Empty", () => {
    renderWelcome();
    expect(screen.getByTestId("thread-empty")).toBeInTheDocument();
  });

  it("renders the title with bold font weight", () => {
    renderWelcome();
    const title = screen.getByText("WelcomeTitle");
    expect(title.tagName).toBe("P");
    expect(title.className).toContain("font-[700]");
  });

  it("renders the description with correct text size", () => {
    renderWelcome();
    const desc = screen.getByText("WelcomeDescription");
    expect(desc.tagName).toBe("P");
    expect(desc.className).toContain("text-fs-20");
  });

  it("overrides title and description from widget config", () => {
    renderWelcome({
      welcomeTitle: "Custom title",
      welcomeDescription: "Custom description",
    });
    expect(screen.getByText("Custom title")).toBeInTheDocument();
    expect(screen.getByText("Custom description")).toBeInTheDocument();
    expect(screen.queryByText("WelcomeTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("WelcomeDescription")).not.toBeInTheDocument();
  });
});
