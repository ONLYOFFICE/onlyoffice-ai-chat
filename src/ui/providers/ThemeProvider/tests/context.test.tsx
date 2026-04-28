// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";

// Disable the global setup.ts mocks for ThemeProvider so we can test the real one.
vi.unmock("../../ThemeProvider/context");
vi.unmock("../../ThemeProvider");

// Provide platform + stores for the real ThemeProvider.
const themeStoreState = {
  themeId: "theme-light",
  themeType: "light" as const,
  scale: 1,
  setThemeId: vi.fn((id: string) => {
    themeStoreState.themeId = id;
    themeStoreState.themeType = id.includes("dark") ? "dark" : "light";
  }),
  initFromPlatform: vi.fn(),
};

const platformValue = {
  env: {
    theme: "theme-light",
    systemTheme: "light" as const,
    locale: "en",
    devicePixelRatio: 1,
    onEnvironmentChange: undefined as
      | ((cb: (info: { theme?: string }) => void) => () => void)
      | undefined,
  },
};

vi.mock("../../../platform/context", () => ({
  usePlatform: () => platformValue,
}));

vi.mock("../../../store/context", () => ({
  useStores: () => ({
    useThemeStore: () => themeStoreState,
  }),
}));

import { ThemeProvider, useTheme, getThemeType } from "../context";

function resetState() {
  themeStoreState.themeId = "theme-light";
  themeStoreState.themeType = "light";
  themeStoreState.scale = 1;
  themeStoreState.setThemeId.mockClear();
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
    let cb: ((info: { theme?: string }) => void) | undefined;
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
    expect(container.querySelector("style")?.textContent).toContain(
      ".theme-x"
    );
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

  it("renders no inline style when customTheme has only undefined values", () => {
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
    expect(themed.getAttribute("style")).toBe(null);
  });

  it("getThemeType is re-exported", () => {
    expect(getThemeType("theme-night")).toBe("dark");
    expect(getThemeType("theme-light")).toBe("light");
  });
});
