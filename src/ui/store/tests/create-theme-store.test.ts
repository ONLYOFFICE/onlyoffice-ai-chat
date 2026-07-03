import { describe, expect, it } from "vitest";
import type { AppContext } from "../../../app-context";
import { createThemeStore } from "../create-theme-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(theme = "theme-light", devicePixelRatio = 1): AppContext {
  return {
    platform: { env: { theme, devicePixelRatio } },
  } as unknown as AppContext;
}

describe("createThemeStore", () => {
  it("seeds theme and scale from the platform on creation", () => {
    const store = createThemeStore(makeCtx("theme-night", 1.5));
    const state = store.getState();
    expect(state.themeId).toBe("theme-night");
    expect(state.themeType).toBe("dark");
    expect(state.scale).toBe(1.5);
    expect(state.initialized).toBe(true);
  });

  it("resolves the theme type of the seeded theme", () => {
    const store = createThemeStore(makeCtx("theme-white"));
    const state = store.getState();
    expect(state.themeId).toBe("theme-white");
    expect(state.themeType).toBe("light");
  });

  it("falls back to a bundled theme when the platform gives no theme", () => {
    const store = createThemeStore(makeCtx(""));
    const state = store.getState();
    expect(state.themeId).toBe("theme-white");
    expect(state.themeType).toBe("light");
  });

  it("passes an unbundled custom theme name through untouched", () => {
    const store = createThemeStore(makeCtx("theme-custom"));
    expect(store.getState().themeId).toBe("theme-custom");
  });

  describe("setThemeId", () => {
    it("sets light theme", () => {
      const store = createThemeStore(makeCtx());
      store.getState().setThemeId("theme-classic-light");
      expect(store.getState().themeId).toBe("theme-classic-light");
      expect(store.getState().themeType).toBe("light");
    });

    it("detects dark theme", () => {
      const store = createThemeStore(makeCtx());
      store.getState().setThemeId("theme-dark");
      expect(store.getState().themeType).toBe("dark");
    });

    it("detects night theme as dark", () => {
      const store = createThemeStore(makeCtx());
      store.getState().setThemeId("theme-night");
      expect(store.getState().themeType).toBe("dark");
    });

    it("detects contrast-dark as dark", () => {
      const store = createThemeStore(makeCtx());
      store.getState().setThemeId("theme-contrast-dark");
      expect(store.getState().themeType).toBe("dark");
    });
  });

  describe("setScale", () => {
    it("updates scale", () => {
      const store = createThemeStore(makeCtx());
      store.getState().setScale(2);
      expect(store.getState().scale).toBe(2);
    });
  });

  describe("initFromPlatform", () => {
    it("is a no-op after the eager seed and keeps the seeded values", () => {
      const store = createThemeStore(makeCtx("theme-dark", 1.5));
      store.getState().initFromPlatform();
      const state = store.getState();
      expect(state.themeId).toBe("theme-dark");
      expect(state.themeType).toBe("dark");
      expect(state.scale).toBe(1.5);
      expect(state.initialized).toBe(true);
    });

    it("does not overwrite a runtime theme change", () => {
      const store = createThemeStore(makeCtx("theme-night", 2));
      // Change theme at runtime
      store.getState().setThemeId("theme-white");
      // A late init call must not clobber it back to the platform theme
      store.getState().initFromPlatform();
      expect(store.getState().themeId).toBe("theme-white");
    });
  });
});
