import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { usePlatform } from "../platform/context";
import { useStores } from "../store/context";
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
  const { themeId, themeType, scale, setThemeId, initFromPlatform } =
    useThemeStore();

  // --- Initialize from platform on first render ---
  initFromPlatform();

  // --- Apply consumer-provided theme prop (once, after platform init) ---
  const appliedInitialTheme = useRef(false);
  if (theme && !appliedInitialTheme.current) {
    appliedInitialTheme.current = true;
    setThemeId(theme);
  }

  // --- Listen for platform environment changes (theme) ---
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
    });

    return () => {
      unsubscribe?.();
    };
  }, [setThemeId, platform]);

  // --- Build inline style from customTheme overrides ---
  const inlineStyle = useMemo(() => {
    if (!customTheme) return undefined;
    const style: Record<string, string> = {};
    for (const [key, value] of Object.entries(customTheme)) {
      if (value !== undefined) {
        style[key] = value;
      }
    }
    return Object.keys(style).length > 0 ? style : undefined;
  }, [customTheme]);

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

  // --- Context value ---
  const value: ThemeContextValue = useMemo(
    () => ({
      themeId,
      themeType,
      setTheme: setThemeId,
      scale,
    }),
    [themeId, themeType, setThemeId, scale]
  );

  return (
    <ThemeContext.Provider value={value}>
      {customStyleContent ? <style>{customStyleContent}</style> : null}
      <div
        className={themeId}
        style={inlineStyle as React.CSSProperties | undefined}
      >
        {children}
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
