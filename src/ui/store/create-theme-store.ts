import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../../app-context";
import {
  type ThemeType,
  getThemeType,
} from "../providers/ThemeProvider/constants";

/**
 * Zustand state for the widget's visual theme and display scale.
 *
 * Reads initial values from the platform adapter and exposes setters
 * so the host application can update the theme or scale at runtime.
 */
export interface ThemeStoreState {
  /** Current theme identifier (e.g. "theme-light", "theme-dark"). */
  themeId: string;
  /** Resolved theme category derived from {@link themeId} ("light" or "dark"). */
  themeType: ThemeType;
  /** Device pixel ratio / UI scale factor. */
  scale: number;
  /** `true` once theme and scale have been seeded from the platform. */
  initialized: boolean;
  /** Set the active theme by ID and recompute the theme type. */
  setThemeId: (id: string) => void;
  /** Update the UI scale factor. */
  setScale: (scale: number) => void;
  /**
   * Re-read theme and scale from the platform adapter. The store is already
   * seeded eagerly at creation, so this is a no-op unless {@link initialized}
   * is `false`. Retained so {@link createThemeStore} consumers (e.g.
   * ThemeProvider) can call it safely.
   */
  initFromPlatform: () => void;
}

export function createThemeStore(
  ctx: AppContext
): UseBoundStore<StoreApi<ThemeStoreState>> {
  const initialThemeId = ctx.platform.env.theme || "theme-white";

  return create<ThemeStoreState>((set, get) => ({
    themeId: initialThemeId,
    themeType: getThemeType(initialThemeId),
    scale: ctx.platform.env.devicePixelRatio,
    initialized: true,

    setThemeId: (id) => set({ themeId: id, themeType: getThemeType(id) }),

    setScale: (scale) => set({ scale }),

    initFromPlatform: () => {
      if (get().initialized) return;
      const themeId = ctx.platform.env.theme;
      set({
        themeId,
        themeType: getThemeType(themeId),
        scale: ctx.platform.env.devicePixelRatio,
        initialized: true,
      });
    },
  }));
}
