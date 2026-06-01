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

const providersImageMap = import.meta.glob<string>(
  "../assets/providers/*.png",
  {
    eager: true,
    import: "default",
  }
) as ImageMap;

export const lightImages = buildCollections({
  ...lightImageMap,
  ...formatsPngMap,
  ...providersImageMap,
});
export const darkImages = buildCollections({
  ...darkImageMap,
  ...formatsPngMap,
  ...providersImageMap,
});

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
  };
};

import type { ProviderType } from "../types";

const FALLBACK_PROVIDER = "openai";

export const getProviderImageSrc = (
  providerType: ProviderType,
  theme: ThemeType = "light",
  scale: number = 1
): string => {
  // Try exact provider name first, then fallback
  const exact = getImageSrc(providerType, theme, scale);
  if (exact) return exact.src;

  return getImageSrc(FALLBACK_PROVIDER, theme, scale)?.src || "";
};
