import type { IconName } from "./generated-types";

/**
 * Override value for an icon. Can be one of three forms:
 * - A static URL string or data-URI.
 * - A React component (e.g. inline SVG).
 * - A function `(theme, scale) => string` that returns a URL based on the
 *   current theme and display scale.
 */
export type ImageOverride =
  | string
  | React.ComponentType<{ size?: number; className?: string }>
  | ((theme: "light" | "dark", scale: number) => string);

/** Resolved image source with a flag indicating whether it is an SVG. */
export interface ImageResult {
  /** The resolved image URL or data-URI. */
  src: string;
  /** `true` when the source points to an SVG image. */
  isSvg: boolean;
  /**
   * Pixel-density the resolved raster was authored for (e.g. `2` for a `@2x`
   * PNG). Absent for host-provided overrides and SVG sources, whose density
   * is not fixed. `<Icon>` uses this to fall back to a bundled vector when the
   * requested scale exceeds the densest available raster.
   */
  scale?: number;
}

/** Value exposed by the images React context for resolving icon/image assets. */
export interface ImagesContextValue {
  /** Resolve an image by name, theme, and scale. Returns null if not found. */
  getImageSrc: (
    name: string,
    theme: "light" | "dark",
    scale: number
  ) => ImageResult | null;

  /**
   * Get a React component override for an icon (if the override is a component).
   * Returns null when the override is a string/function or no override exists.
   */
  getIconComponent: (
    name: string
  ) => React.ComponentType<{ size?: number; className?: string }> | null;

  /**
   * Resolve a bundled SVG icon as a React component (compiled by SVGR at
   * build time). `<Icon>` falls back to this when neither host override
   * nor `getImageSrc` produces a result. Hosts normally don't call this
   * directly — bundle-shadowing goes through {@link getIconComponent}.
   * Returns `null` when no bundled SVG matches the name.
   */
  getBundledIcon: (
    name: string
  ) => React.ComponentType<React.SVGProps<SVGSVGElement>> | null;

  /** Resolve a provider logo URL by provider type. */
  getProviderImageSrc: (
    providerType: string,
    theme?: "light" | "dark",
    scale?: number
  ) => string;

  /**
   * Preferred icon format when a name resolves to both a bundled SVG
   * component and a bundled raster (PNG) set.
   * - `"svg"` (default): the bundled SVG component wins; raster PNGs are only
   *   used for names that have no SVG. This is the historical behavior.
   * - `"png"`: the scale-appropriate raster PNG wins, falling back to the
   *   bundled SVG when no PNG matches the name.
   * Host component/URL overrides always take priority over both, regardless
   * of this preference.
   */
  iconFormat: "svg" | "png";
}

/**
 * A partial map of icon names to their override values. Keys can be any
 * generated {@link IconName} or an arbitrary string for forward-compat.
 */
export type ImageOverrides = Partial<
  Record<IconName | (string & {}), ImageOverride>
>;

export type { IconName };
