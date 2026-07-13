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

describe("ThreadWelcome", () => {
  it("renders welcome title and description", () => {
    render(<ThreadWelcome />);
    expect(screen.getByText("WelcomeTitle")).toBeInTheDocument();
    expect(screen.getByText("WelcomeDescription")).toBeInTheDocument();
  });

  it("wraps content in ThreadPrimitive.Empty", () => {
    render(<ThreadWelcome />);
    expect(screen.getByTestId("thread-empty")).toBeInTheDocument();
  });

  it("renders the title with bold font weight", () => {
    render(<ThreadWelcome />);
    const title = screen.getByText("WelcomeTitle");
    expect(title.tagName).toBe("P");
    expect(title.className).toContain("font-[700]");
  });

  it("renders the description with correct text size", () => {
    render(<ThreadWelcome />);
    const desc = screen.getByText("WelcomeDescription");
    expect(desc.tagName).toBe("P");
    expect(desc.className).toContain("text-fs-20");
  });
});
