import { memo, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { ReactSVG } from "react-svg";
import { useImages } from "../../providers/ImagesProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { decodeSvgDataUrl } from "./inline-svg";

type IconProps = {
  name: string;
  size?: number;
  width?: number;
  height?: number;
  isStroke?: boolean;
  color?: string;
  noColor?: boolean;
  className?: string;
};

const IconComponent = ({
  name,
  size,
  width,
  height,
  isStroke,
  color,
  noColor,
  className,
}: IconProps) => {
  const w = width ?? size;
  const h = height ?? size;
  const { themeType, scale } = useTheme();
  const { getImageSrc, getIconComponent } = useImages();
  const image = getImageSrc(name, themeType, scale);
  const CustomIcon = getIconComponent(name);

  const applyColors = useCallback(
    (svg: SVGSVGElement) => {
      if (noColor) return;

      const fillColor = color || "var(--icon-button-color)";
      const attr = isStroke ? "stroke" : "fill";

      svg.querySelectorAll("path").forEach((el) => {
        el.setAttribute(attr, fillColor);
      });
      svg.querySelectorAll("circle").forEach((el) => {
        el.setAttribute(attr, fillColor);
      });
    },
    [noColor, color, isStroke]
  );

  // Vite's lib mode inlines all assets as `data:` URLs (and ignores
  // `assetsInlineLimit`). We can't feed those into react-svg because it
  // `fetch()`es the src to inject the markup — strict host CSPs reject
  // the `data:` scheme on `connect-src`. For data URLs we decode the
  // markup inline and apply the same color/stroke logic via a ref.
  const inlineSvgMarkup = useMemo(() => {
    if (!image?.isSvg) return null;
    return decodeSvgDataUrl(image.src);
  }, [image]);

  if (CustomIcon) {
    return <CustomIcon size={w ?? h} className={className} />;
  }

  if (!image) {
    return null;
  }

  if (inlineSvgMarkup !== null) {
    return (
      <InlineSvg
        markup={inlineSvgMarkup}
        applyColors={applyColors}
        className={className}
        width={w}
        height={h}
      />
    );
  }

  if (image.isSvg) {
    // Fallback for hosts that override `getImageSrc` to return a
    // network URL instead of the bundled data URL. Same code path as
    // before the inline-data fix.
    return (
      <ReactSVG
        src={image.src}
        className={`flex items-center justify-center ${className || ""}`}
        beforeInjection={applyColors}
        style={{ width: w, height: h }}
      />
    );
  }

  return (
    <img
      src={image.src}
      alt={name}
      className={className}
      style={{ width: w, height: h }}
    />
  );
};

type InlineSvgProps = {
  markup: string;
  applyColors: (svg: SVGSVGElement) => void;
  className?: string;
  width?: number;
  height?: number;
};

const InlineSvg = ({
  markup,
  applyColors,
  className,
  width,
  height,
}: InlineSvgProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    applyColors(svg);
    if (width !== undefined) svg.setAttribute("width", String(width));
    if (height !== undefined) svg.setAttribute("height", String(height));
  }, [markup, applyColors, width, height]);

  return (
    <span
      ref={ref}
      className={`flex items-center justify-center ${className || ""}`}
      style={{ width, height }}
      // SVG markup comes from our own bundled assets — decoded from a
      // data URL Vite emitted at build time. Not user input.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

const Icon = memo(IconComponent);
export { Icon };
