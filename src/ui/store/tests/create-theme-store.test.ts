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
  it("starts with light theme defaults", () => {
    const store = createThemeStore(makeCtx());
    const state = store.getState();
    expect(state.themeId).toBe("theme-light");
    expect(state.themeType).toBe("light");
    expect(state.scale).toBe(1);
    expect(state.initialized).toBe(false);
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
    it("initializes from platform env", () => {
      const store = createThemeStore(makeCtx("theme-dark", 1.5));
      store.getState().initFromPlatform();
      const state = store.getState();
      expect(state.themeId).toBe("theme-dark");
      expect(state.themeType).toBe("dark");
      expect(state.scale).toBe(1.5);
      expect(state.initialized).toBe(true);
    });

    it("initializes only once", () => {
      const store = createThemeStore(makeCtx("theme-dark", 2));
      store.getState().initFromPlatform();
      // Change theme after init
      store.getState().setThemeId("theme-light");
      // Second init should be no-op
      store.getState().initFromPlatform();
      expect(store.getState().themeId).toBe("theme-light");
    });
  });
});
