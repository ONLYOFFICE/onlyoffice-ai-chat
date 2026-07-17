// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";

// Disable the global setup.ts mocks for ThemeProvider so we can test the real one.
vi.unmock("../../ThemeProvider/context");
vi.unmock("../../ThemeProvider");

// Provide platform + stores for the real ThemeProvider.
const themeStoreState = {
  themeId: "theme-light",
  themeType: "light" as "light" | "dark",
  scale: 1,
  setThemeId: vi.fn((id: string) => {
    themeStoreState.themeId = id;
    // Classify with the real helper (imported below; ESM bindings are
    // hoisted) so ids like "theme-night" resolve exactly as in the store.
    themeStoreState.themeType = getThemeType(id);
  }),
  setScale: vi.fn((scale: number) => {
    themeStoreState.scale = scale;
  }),
  initFromPlatform: vi.fn(),
};

type EnvChangeInfo = {
  theme?: string;
  lang?: string;
  devicePixelRatio?: number;
};

const platformValue = {
  env: {
    theme: "theme-light",
    systemTheme: "light" as "light" | "dark",
    locale: "en",
    devicePixelRatio: 1,
    onEnvironmentChange: undefined as
      | ((cb: (info: EnvChangeInfo) => void) => () => void)
      | undefined,
  },
};

vi.mock("../../PlatformProvider/context", () => ({
  usePlatform: () => platformValue,
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useThemeStore: (selector?: (s: typeof themeStoreState) => unknown) =>
      selector ? selector(themeStoreState) : themeStoreState,
  }),
}));

import { ThemeProvider, useTheme, getThemeType } from "../context";

function resetState() {
  themeStoreState.themeId = "theme-light";
  themeStoreState.themeType = "light";
  themeStoreState.scale = 1;
  themeStoreState.setThemeId.mockClear();
  themeStoreState.setScale.mockClear();
  themeStoreState.initFromPlatform.mockClear();
  platformValue.env.systemTheme = "light";
  platformValue.env.onEnvironmentChange = undefined;
}

describe("ThemeProvider", () => {
  it("useTheme throws outside provider", () => {
    resetState();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
    errorSpy.mockRestore();
  });

  it("returns themed values via useTheme", () => {
    resetState();
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });
    expect(result.current.themeId).toBe("theme-light");
    expect(result.current.themeType).toBe("light");
    expect(result.current.scale).toBe(1);
  });

  it("calls initFromPlatform on render", () => {
    resetState();
    render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );
    expect(themeStoreState.initFromPlatform).toHaveBeenCalled();
  });

  it("syncs theme prop into store on first render and on change", () => {
    resetState();
    const { rerender } = render(
      <ThemeProvider theme="theme-dark">
        <span />
      </ThemeProvider>
    );
    expect(themeStoreState.setThemeId).toHaveBeenCalledWith("theme-dark");
    themeStoreState.setThemeId.mockClear();
    rerender(
      <ThemeProvider theme="theme-dark">
        <span />
      </ThemeProvider>
    );
    expect(themeStoreState.setThemeId).not.toHaveBeenCalled();
    rerender(
      <ThemeProvider theme="theme-night">
        <span />
      </ThemeProvider>
    );
    expect(themeStoreState.setThemeId).toHaveBeenCalledWith("theme-night");
  });

  it("subscribes to platform.env.onEnvironmentChange and forwards explicit theme", () => {
    resetState();
    let cb: ((info: { theme?: string }) => void) | undefined;
    const unsubscribe = vi.fn();
    platformValue.env.onEnvironmentChange = vi.fn((handler) => {
      cb = handler;
      return unsubscribe;
    });

    const { unmount } = render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );
    expect(cb).toBeDefined();

    act(() => cb!({ theme: "theme-dark" }));
    expect(themeStoreState.setThemeId).toHaveBeenCalledWith("theme-dark");

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("resolves theme-system to systemTheme variant", () => {
    resetState();
    let cb: ((info: { theme?: string }) => void) | undefined;
    platformValue.env.onEnvironmentChange = vi.fn((handler) => {
      cb = handler;
      return () => {};
    });
    platformValue.env.systemTheme = "dark";
    render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );

    act(() => cb!({ theme: "theme-system" }));
    expect(themeStoreState.setThemeId).toHaveBeenCalledWith("theme-night");

    platformValue.env.systemTheme = "light";
    act(() => cb!({ theme: "theme-system" }));
    expect(themeStoreState.setThemeId).toHaveBeenCalledWith("theme-white");
  });

  it("ignores onEnvironmentChange events without theme", () => {
    resetState();
    let cb: ((info: EnvChangeInfo) => void) | undefined;
    platformValue.env.onEnvironmentChange = vi.fn((handler) => {
      cb = handler;
      return () => {};
    });
    render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );
    act(() => cb!({}));
    expect(themeStoreState.setThemeId).not.toHaveBeenCalled();
    expect(themeStoreState.setScale).not.toHaveBeenCalled();
  });

  it("forwards devicePixelRatio changes to setScale", () => {
    resetState();
    let cb: ((info: EnvChangeInfo) => void) | undefined;
    platformValue.env.onEnvironmentChange = vi.fn((handler) => {
      cb = handler;
      return () => {};
    });
    render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );

    act(() => cb!({ devicePixelRatio: 2 }));
    expect(themeStoreState.setScale).toHaveBeenCalledWith(2);
    // A theme-only event must not touch scale.
    themeStoreState.setScale.mockClear();
    act(() => cb!({ theme: "theme-dark" }));
    expect(themeStoreState.setScale).not.toHaveBeenCalled();
  });

  it("renders customThemes as CSS blocks and applies inline customTheme", () => {
    resetState();
    const { container } = render(
      <ThemeProvider
        customTheme={
          { "--accent": "#f00", "--unset": undefined } as Partial<
            Record<string, string>
          >
        }
        customThemes={{
          "theme-x": { "--bg": "#fff" } as Partial<Record<string, string>>,
          "theme-empty": {} as Partial<Record<string, string>>,
        }}
      >
        <span>child</span>
      </ThemeProvider>
    );
    expect(container.querySelector("style")?.textContent).toContain(".theme-x");
    expect(container.querySelector("style")?.textContent).toContain("--bg");
    expect(container.querySelector("style")?.textContent).not.toContain(
      ".theme-empty"
    );
    const themed = container.querySelector(".theme-light") as HTMLElement;
    expect(themed.style.getPropertyValue("--accent")).toBe("#f00");
  });

  it("renders no <style> when no customThemes provided", () => {
    resetState();
    const { container } = render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );
    expect(container.querySelector("style")).toBeNull();
  });

  it("skips undefined customTheme values", () => {
    resetState();
    const { container } = render(
      <ThemeProvider
        customTheme={
          { "--unset": undefined } as Partial<Record<string, string>>
        }
      >
        <span />
      </ThemeProvider>
    );
    const themed = container.querySelector(".theme-light") as HTMLElement;
    // An undefined customTheme override must not be emitted.
    expect(themed.style.getPropertyValue("--unset")).toBe("");
  });

  it("getThemeType is re-exported", () => {
    expect(getThemeType("theme-night")).toBe("dark");
    expect(getThemeType("theme-light")).toBe("light");
  });

  it("exposes data-theme-type=light on the wrapper for a light theme", () => {
    resetState();
    const { container } = render(
      <ThemeProvider>
        <span />
      </ThemeProvider>
    );
    const themed = container.querySelector(".theme-light") as HTMLElement;
    expect(themed.getAttribute("data-theme-type")).toBe("light");
  });

  it("exposes data-theme-type=dark on the wrapper for a dark built-in theme", () => {
    resetState();
    const { container } = render(
      <ThemeProvider theme="theme-night">
        <span />
      </ThemeProvider>
    );
    const themed = container.querySelector(".theme-night") as HTMLElement;
    expect(themed.getAttribute("data-theme-type")).toBe("dark");
  });

  it("exposes data-theme-type=dark for a custom theme id containing 'dark'", () => {
    resetState();
    const { container } = render(
      <ThemeProvider theme="theme-portal-dark">
        <span />
      </ThemeProvider>
    );
    const themed = container.querySelector(".theme-portal-dark") as HTMLElement;
    expect(themed.getAttribute("data-theme-type")).toBe("dark");
  });
});
