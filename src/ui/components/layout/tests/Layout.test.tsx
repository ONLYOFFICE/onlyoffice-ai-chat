// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockFetchClouds = vi.fn();

let currentPage = "chat";
let mockIsRTL = false;

vi.mock("../../../providers/LocalesProvider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    changeLocale: vi.fn(),
    isRTL: mockIsRTL,
    direction: mockIsRTL ? ("rtl" as const) : ("ltr" as const),
  }),
}));

const mockOnCloudsChange = vi.fn(() => {
  return vi.fn(); // unsubscribe fn
});

vi.mock("../../../platform/context", () => ({
  usePlatform: () => ({
    env: {
      locale: "en",
    },
    clouds: {
      onCloudsChange: (...args: unknown[]) =>
        mockOnCloudsChange(...(args as Parameters<typeof mockOnCloudsChange>)),
    },
  }),
}));

vi.mock("../../../../store/context", () => ({
  useStores: () => ({
    useRouter: (selector?: (s: unknown) => unknown) => {
      const state = { currentPage };
      return selector ? selector(state) : state;
    },
    useCloudsStore: (selector?: (s: unknown) => unknown) => {
      const state = { fetchClouds: mockFetchClouds };
      return selector ? selector(state) : state;
    },
  }),
}));

vi.mock("../sub-components/Header", () => ({
  Navigation: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock("../sub-components/ChatList", () => ({
  ChatList: () => <div data-testid="chat-list">ChatList</div>,
}));

import { Layout } from "../index";

describe("Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPage = "chat";
    mockIsRTL = false;
  });

  it("renders without crashing", () => {
    render(
      <Layout>
        <div>child content</div>
      </Layout>
    );
    expect(screen.getByTestId("navigation")).toBeInTheDocument();
  });

  it("renders children when currentPage is chat", () => {
    render(
      <Layout>
        <div data-testid="child">Hello</div>
      </Layout>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders Navigation header", () => {
    render(
      <Layout>
        <div>child</div>
      </Layout>
    );
    expect(screen.getByTestId("navigation")).toBeInTheDocument();
  });

  it("renders ChatList when currentPage is history", () => {
    currentPage = "history";
    render(
      <Layout>
        <div data-testid="child">Hello</div>
      </Layout>
    );
    expect(screen.getByTestId("chat-list")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("renders children (not ChatList) when page is not history", () => {
    currentPage = "settings";
    render(
      <Layout>
        <div data-testid="child">Hello</div>
      </Layout>
    );
    expect(screen.queryByTestId("chat-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("sets dir=ltr when not RTL", () => {
    const { container } = render(
      <Layout>
        <div>child</div>
      </Layout>
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "ltr");
  });

  it("sets dir=rtl and applies font-rtl class when RTL", () => {
    mockIsRTL = true;
    const { container } = render(
      <Layout>
        <div>child</div>
      </Layout>
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root.className).toContain("font-rtl");
  });

  it("subscribes to onCloudsChange on mount", () => {
    render(
      <Layout>
        <div>child</div>
      </Layout>
    );
    expect(mockOnCloudsChange).toHaveBeenCalled();
  });

  it("renders children wrapped in w-full div when not history", () => {
    const { container } = render(
      <Layout>
        <div data-testid="child">Hello</div>
      </Layout>
    );
    const wFullDiv = container.querySelector(".w-full");
    expect(wFullDiv).not.toBeNull();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders main element with id=app", () => {
    const { container } = render(
      <Layout>
        <div>child</div>
      </Layout>
    );
    const main = container.querySelector("#app");
    expect(main).not.toBeNull();
    expect(main?.tagName).toBe("MAIN");
  });
});
