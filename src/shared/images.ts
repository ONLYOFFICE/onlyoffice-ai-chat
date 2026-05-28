const VECTOR_IMAGE_SCALE = 2.5;
const IMAGE_NAME_REGEX = /\/([^/@]+?)(?:@([\d.]+)x)?\.(png|svg)(?:\?url)?$/;

type ImageMap = Record<string, string>;

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

// `?no-inline` opts out of Vite's lib-mode force-inline of every asset
// (see vite/src/node/plugins/asset.ts — when `build.lib` is set, the
// `assetsInlineLimit` option is ignored and everything turns into a
// `data:` URL). SVGs must stay as file URLs because <Icon> renders
// them through react-svg, which `fetch()`es the src — strict host
// CSPs typically permit network schemes in `connect-src` but not
// `data:`, so an inlined SVG gets blocked.
const svgImageMap = import.meta.glob<string>("../assets/*.svg", {
  eager: true,
  import: "default",
  query: "?url&no-inline",
}) as ImageMap;

const formatsPngMap = import.meta.glob<string>("../assets/formats/*.png", {
  eager: true,
  import: "default",
}) as ImageMap;

const formatsSvgMap = import.meta.glob<string>("../assets/formats/*.svg", {
  eager: true,
  import: "default",
  query: "?url&no-inline",
}) as ImageMap;

const providersImageMap = import.meta.glob<string>(
  "../assets/providers/*.png",
  {
    eager: true,
    import: "default",
  }
) as ImageMap;

export const lightImages = buildCollections({
  ...lightImageMap,
  ...svgImageMap,
  ...formatsPngMap,
  ...formatsSvgMap,
  ...providersImageMap,
});
export const darkImages = buildCollections({
  ...darkImageMap,
  ...svgImageMap,
  ...formatsPngMap,
  ...formatsSvgMap,
  ...providersImageMap,
});

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
