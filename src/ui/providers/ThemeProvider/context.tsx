import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlatform } from "../PlatformProvider/context";
import { useStores } from "../../store/context";
import { useScrollbarWidth } from "../../hooks/useScrollbarWidth";
import type { ThemeType } from "./constants";
import { getThemeType } from "./constants";
import type { ThemeTokens } from "./generated-types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Props for the {@link ThemeProvider} component that manages CSS theme
 * classes and custom token overrides.
 */
export interface ThemeProviderProps {
  /** ID of a built-in theme (e.g. "theme-dark"). Overrides platform default. */
  theme?: string;
  /** Override individual CSS custom properties on top of the active theme. */
  customTheme?: Partial<ThemeTokens>;
  /** Register additional named themes (className → token overrides). */
  customThemes?: Record<string, Partial<ThemeTokens>>;
  children: React.ReactNode;
}

/**
 * Value exposed by the theme React context. Consumers access this via
 * the {@link useTheme} hook.
 */
export interface ThemeContextValue {
  /** The active theme identifier (e.g. `"theme-dark"`). */
  themeId: string;
  /** Whether the active theme is `"light"` or `"dark"`. */
  themeType: ThemeType;
  /** Switch to a different theme by ID at runtime. */
  setTheme: (id: string) => void;
  /** Current UI scale factor (e.g. `1`, `1.25`). */
  scale: number;
  /** The themed container element for portal targets. */
  portalContainer: HTMLElement | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Provides theme context to the widget tree. Applies the active theme as
 * a CSS class, injects custom token overrides as inline styles, and
 * generates `<style>` blocks for any registered custom themes. Listens
 * for platform environment changes to switch themes dynamically.
 *
 * @example
 * ```tsx
 * <ThemeProvider theme="theme-dark" customTheme={{ "--color-primary": "#ff0" }}>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export const ThemeProvider = ({
  theme,
  customTheme,
  customThemes,
  children,
}: ThemeProviderProps) => {
  const platform = usePlatform();
  const { useThemeStore } = useStores();
  const themeId = useThemeStore((s) => s.themeId);
  const themeType = useThemeStore((s) => s.themeType);
  const scale = useThemeStore((s) => s.scale);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const setScale = useThemeStore((s) => s.setScale);
  const initFromPlatform = useThemeStore((s) => s.initFromPlatform);

  // --- Initialize from platform on first render ---
  initFromPlatform();

  // --- Keep store in sync with consumer-provided theme prop ---
  const prevThemeRef = useRef<string | undefined>(undefined);
  if (theme && theme !== prevThemeRef.current) {
    prevThemeRef.current = theme;
    setThemeId(theme);
  }

  // --- Listen for platform environment changes (theme, display density) ---
  useLayoutEffect(() => {
    const unsubscribe = platform.env.onEnvironmentChange?.((info) => {
      if (info.theme) {
        if (info.theme === "theme-system") {
          const resolved =
            platform.env.systemTheme === "dark" ? "theme-night" : "theme-white";
          setThemeId(resolved);
        } else {
          setThemeId(info.theme);
        }
      }
      // A changed display density re-selects scale-appropriate raster icons
      // (in `iconFormat: "png"` mode). Absent field → keep the startup scale.
      if (info.devicePixelRatio !== undefined) {
        setScale(info.devicePixelRatio);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [setThemeId, setScale, platform]);

  // Real scrollbar width, published on the theme root (below) as
  // `--scrollbar-width` alongside the theme tokens so the whole widget can
  // read it
  const scrollbarWidth = useScrollbarWidth();

  // --- Build inline style from customTheme overrides + runtime tokens ---
  const inlineStyle = useMemo(() => {
    const style: Record<string, string> = {
      "--scrollbar-width": `${scrollbarWidth}px`,
    };
    if (customTheme) {
      for (const [key, value] of Object.entries(customTheme)) {
        if (value !== undefined) {
          style[key] = value;
        }
      }
    }
    return style;
  }, [customTheme, scrollbarWidth]);

  // --- Generate <style> tags for customThemes ---
  const customStyleContent = useMemo(() => {
    if (!customThemes) return null;
    const blocks: string[] = [];
    for (const [name, tokens] of Object.entries(customThemes)) {
      const declarations = Object.entries(tokens)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n");
      if (declarations) {
        blocks.push(`.${name} {\n${declarations}\n}`);
      }
    }
    return blocks.length > 0 ? blocks.join("\n") : null;
  }, [customThemes]);

  // --- Portal container ref ---
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node);
  }, []);

  // --- Context value ---
  const value: ThemeContextValue = useMemo(
    () => ({
      themeId,
      themeType,
      setTheme: setThemeId,
      scale,
      portalContainer,
    }),
    [themeId, themeType, setThemeId, scale, portalContainer]
  );

  return (
    <ThemeContext.Provider value={value}>
      {customStyleContent ? <style>{customStyleContent}</style> : null}
      <div
        className={`${themeId} relative`}
        style={inlineStyle as React.CSSProperties | undefined}
      >
        {children}
        {/* Dedicated portal container with `aui-root` so Radix dialogs /
            dropdowns / tooltips inherit the scoped preflight, while
            ThemeProvider's `children` (which can be host content in
            headless mode) stay outside the reset scope. */}
        <div ref={containerRef} className="aui-root" />
      </div>
    </ThemeContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current theme context value. Must be used within a
 * {@link ThemeProvider}.
 *
 * @throws If called outside of a `ThemeProvider`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

// Re-export for convenience
export { getThemeType };
