/** Theme IDs that are classified as dark themes. */
export const DARK_THEMES = [
  "theme-dark",
  "theme-night",
  "theme-contrast-dark",
] as const;

/** All built-in theme IDs shipped with the widget. */
export const BUILT_IN_THEMES = [
  "theme-light",
  "theme-dark",
  "theme-white",
  "theme-gray",
  "theme-classic-light",
  "theme-night",
  "theme-contrast-dark",
] as const;

/** Resolved theme category — either `"light"` or `"dark"`. */
export type ThemeType = "light" | "dark";

/**
 * Determines whether a theme ID corresponds to a dark or light theme
 * by checking against the {@link DARK_THEMES} list.
 *
 * @param themeId - The theme identifier to classify.
 * @returns `"dark"` if the theme is dark, `"light"` otherwise.
 */
export const getThemeType = (themeId: string): ThemeType =>
  DARK_THEMES.some((dark) => themeId.includes(dark.replace("theme-", "")))
    ? "dark"
    : "light";
