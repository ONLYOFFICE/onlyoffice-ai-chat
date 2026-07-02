import type { ComponentType, SVGProps } from "react";

const VECTOR_IMAGE_SCALE = 2.5;
const IMAGE_NAME_REGEX = /\/([^/@]+?)(?:@([\d.]+)x)?\.(png|svg)(?:\?\w+)?$/;

type ImageMap = Record<string, string>;

export type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;
type SvgComponentMap = Record<string, SvgComponent>;

type ImageCollectionEntry = {
  scale: number;
  src: string;
};

export type ImageCollections = Record<string, ImageCollectionEntry[]>;

const parseImageMeta = (path: string) => {
  const match = path.match(IMAGE_NAME_REGEX);
  if (!match) return null;

  const [, name, scale, ext] = match;
  return {
    name,
    scale: ext === "svg" ? VECTOR_IMAGE_SCALE : scale ? Number(scale) : 1,
  };
};

const buildCollections = (images: ImageMap): ImageCollections => {
  const collections: ImageCollections = {};

  for (const [path, src] of Object.entries(images)) {
    const meta = parseImageMeta(path);
    if (!meta) continue;

    if (!collections[meta.name]) {
      collections[meta.name] = [];
    }
    collections[meta.name].push({ scale: meta.scale, src });
  }

  for (const entries of Object.values(collections)) {
    entries.sort((a, b) => a.scale - b.scale);
  }

  return collections;
};

// NOTE: These globs use `eager: true` which loads all theme variants at module
// parse time. Removing `eager` would make them lazy (returning Promise-based
// loaders), but that would require making getImageSrc async — cascading changes
// through every component that uses images. Since Vite already emits these as
// hashed URL strings (not file contents), the bundle-size impact is minimal.
// A future optimization could load only the active theme's images on demand.
const lightImageMap = import.meta.glob<string>("../assets/light/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

const darkImageMap = import.meta.glob<string>("../assets/dark/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

// SVGs are compiled to React components by `vite-plugin-svgr` (the `?react`
// query). Rendering them as components keeps the bundle self-contained
// (no separate asset files, no data: URLs) and avoids the react-svg
// fetch() path that strict host CSPs reject.
const svgComponentMap = import.meta.glob<SvgComponent>("../assets/*.svg", {
  eager: true,
  import: "default",
  query: "?react",
}) as SvgComponentMap;

const formatsPngMap = import.meta.glob<string>("../assets/formats/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

const formatsSvgComponentMap = import.meta.glob<SvgComponent>(
  "../assets/formats/*.svg",
  {
    eager: true,
    import: "default",
    query: "?react",
  }
) as SvgComponentMap;

// Provider logos are theme-specific: each lives under `providers/light` or
// `providers/dark` and is named `<icon>_<theme>.png` (e.g. `anthropic_light`).
// Unlike the general icon set, these are looked up via `getProviderImageSrc`
// through an explicit provider→icon map, so they stay out of the general
// `light/darkImages` collections.
const providersLightMap = import.meta.glob<string>(
  "../assets/providers/light/*.png",
  {
    eager: true,
    import: "default",
  }
) as ImageMap;

const providersDarkMap = import.meta.glob<string>(
  "../assets/providers/dark/*.png",
  {
    eager: true,
    import: "default",
  }
) as ImageMap;

export const lightImages = buildCollections({
  ...lightImageMap,
  ...formatsPngMap,
});
export const darkImages = buildCollections({
  ...darkImageMap,
  ...formatsPngMap,
});

// Flat `<icon>_<theme>` → src maps. Provider PNGs ship at a single scale,
// so a plain lookup is enough — no scale collection needed.
const buildProviderMap = (images: ImageMap): ImageMap => {
  const map: ImageMap = {};
  for (const [path, src] of Object.entries(images)) {
    const meta = parseImageMeta(path);
    if (!meta) continue;
    map[meta.name] = src;
  }
  return map;
};

const lightProviderImages = buildProviderMap(providersLightMap);
const darkProviderImages = buildProviderMap(providersDarkMap);

const bundledIcons: Record<string, SvgComponent> = {};
for (const [path, component] of Object.entries({
  ...svgComponentMap,
  ...formatsSvgComponentMap,
})) {
  const meta = parseImageMeta(path);
  if (!meta) continue;
  bundledIcons[meta.name] = component;
}

/**
 * Resolve a bundled SVG icon by name. Returns the React component produced
 * by `vite-plugin-svgr`, or `null` when no bundled SVG matches. Theme and
 * scale are accepted for parity with {@link getImageSrc} but currently
 * ignored — bundled SVGs are theme-agnostic and scale as vectors.
 */
export const getBundledIcon = (name: string): SvgComponent | null => {
  return bundledIcons[name] ?? null;
};

type ThemeType = "light" | "dark";

type ImageResult = {
  src: string;
  isSvg: boolean;
  /**
   * Pixel-density the matched raster was authored for (e.g. `2` for a `@2x`
   * PNG). Lets callers detect when the requested `scale` exceeds the densest
   * available raster and fall back to a crisp vector instead of upscaling.
   */
  scale: number;
};

export const getImageSrc = (
  name: string,
  theme: ThemeType,
  scale: number
): ImageResult | null => {
  const collections = theme === "dark" ? darkImages : lightImages;
  const entries = collections[name];

  if (!entries || entries.length === 0) {
    return null;
  }

  // Find best match: first entry with scale >= requested, or highest available
  const match =
    entries.find((e) => e.scale >= scale) || entries[entries.length - 1];

  return {
    src: match.src,
    isSvg: match.scale === VECTOR_IMAGE_SCALE,
    scale: match.scale,
  };
};

import type { ProviderType } from "../types";

// Maps a provider type to its icon base name (theme suffix added at lookup).
// Providers without a dedicated logo fall through to `custom_provider`.
const PROVIDER_ICON_NAMES: Record<string, string> = {
  anthropic: "anthropic",
  openai: "openai",
  openaicompatible: "openai",
  together: "togetherai",
  openrouter: "open_router",
  genai: "google_ai",
  deepseek: "deepseek",
  xai: "xai",
  "lm-studio": "lm_studio",
  mistral: "mistral",
  ollama: "ollama",
  external: "custom_provider",
};

const FALLBACK_PROVIDER_ICON = "custom_provider";

export const getProviderImageSrc = (
  providerType: ProviderType,
  theme: ThemeType = "light"
): string => {
  const base = PROVIDER_ICON_NAMES[providerType] ?? FALLBACK_PROVIDER_ICON;
  const map = theme === "dark" ? darkProviderImages : lightProviderImages;
  return (
    map[`${base}_${theme}`] ?? map[`${FALLBACK_PROVIDER_ICON}_${theme}`] ?? ""
  );
};
