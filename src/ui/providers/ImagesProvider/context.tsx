import { createContext, useContext, useMemo } from "react";
import {
  getBundledIcon as getBundledIconInternal,
  getImageSrc as getImageSrcInternal,
  getProviderImageSrc as getProviderImageSrcInternal,
} from "../../../shared/images";
import { defaultImages } from "./defaults";
import type {
  ImageOverride,
  ImageOverrides,
  ImagesContextValue,
} from "./types";

const ImagesContext = createContext<ImagesContextValue>(defaultImages);

export interface ImagesProviderProps {
  overrides?: ImageOverrides;
  /**
   * Preferred icon format for names that ship as both a bundled SVG and a
   * raster PNG set. Defaults to `"svg"` (historical behavior). See
   * {@link ImagesContextValue.iconFormat}.
   */
  iconFormat?: "svg" | "png";
  children: React.ReactNode;
}

const isComponent = (
  v: ImageOverride
): v is React.ComponentType<{ size?: number; className?: string }> =>
  typeof v === "object" || (typeof v === "function" && v.length <= 1);

const isThemeFunction = (
  v: ImageOverride
): v is (theme: "light" | "dark", scale: number) => string =>
  typeof v === "function" && !isComponent(v);

export const ImagesProvider = ({
  overrides,
  iconFormat = "svg",
  children,
}: ImagesProviderProps) => {
  const value = useMemo<ImagesContextValue>(() => {
    if (!overrides) {
      return iconFormat === defaultImages.iconFormat
        ? defaultImages
        : { ...defaultImages, iconFormat };
    }

    return {
      iconFormat,
      getImageSrc: (name, theme, scale) => {
        const override = overrides[name];
        if (override !== undefined) {
          if (typeof override === "string") {
            return { src: override, isSvg: override.endsWith(".svg") };
          }
          if (isThemeFunction(override)) {
            const src = override(theme, scale);
            return { src, isSvg: src.endsWith(".svg") };
          }
          // Component override — return null so Icon renders the component
          return null;
        }
        return getImageSrcInternal(name, theme, scale);
      },

      getIconComponent: (name) => {
        const override = overrides[name];
        if (override !== undefined && isComponent(override)) {
          return override;
        }
        return null;
      },

      getBundledIcon: getBundledIconInternal,

      getProviderImageSrc: (providerType, theme = "light", scale = 1) => {
        const override = overrides[providerType];
        if (override !== undefined) {
          if (typeof override === "string") return override;
          if (isThemeFunction(override)) return override(theme, scale);
        }
        return getProviderImageSrcInternal(providerType, theme);
      },
    };
  }, [overrides, iconFormat]);

  return (
    <ImagesContext.Provider value={value}>{children}</ImagesContext.Provider>
  );
};

export const useImages = (): ImagesContextValue => {
  return useContext(ImagesContext);
};
