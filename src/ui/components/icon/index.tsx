import { memo, useLayoutEffect, useRef } from "react";
import { ReactSVG } from "react-svg";
import { useImages } from "../../providers/ImagesProvider";
import { useTheme } from "../../providers/ThemeProvider";

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

const SHAPE_SELECTOR = "path, circle, rect, line, polygon, polyline, ellipse";

const isPaintSet = (value: string | null) =>
  value !== null && value !== "" && value !== "none";

// Recolor each shape by the paint method it already declares: an element
// with an explicit `stroke` gets its stroke recolored, one with an explicit
// `fill` gets its fill recolored, and one declaring both gets both. This
// keeps mixed icons (e.g. stroked outline + filled detail) consistent. When
// a shape declares neither, we fall back to the caller's `isStroke` hint.
const applySvgColor = (
  svg: SVGSVGElement,
  isStroke: boolean | undefined,
  color: string | undefined,
  noColor: boolean | undefined
) => {
  if (noColor) return;
  const paintColor = color || "var(--icon-button-color)";
  svg.querySelectorAll(SHAPE_SELECTOR).forEach((el) => {
    const hasStroke = isPaintSet(el.getAttribute("stroke"));
    const hasFill = isPaintSet(el.getAttribute("fill"));
    if (!hasStroke && !hasFill) {
      el.setAttribute(isStroke ? "stroke" : "fill", paintColor);
      return;
    }
    if (hasStroke) el.setAttribute("stroke", paintColor);
    if (hasFill) el.setAttribute("fill", paintColor);
  });
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
  const { getImageSrc, getIconComponent, getBundledIcon, iconFormat } =
    useImages();
  const CustomIcon = getIconComponent(name);
  const BundledIcon = CustomIcon ? null : getBundledIcon(name);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Re-apply theme/color attributes whenever the wrapped SVG re-renders
  // (theme switch, color prop change, name change). Both bundled (SVGR) and
  // host-supplied custom icon components render a fresh DOM tree, so attribute
  // mutations from a prior render don't carry over — we always do a clean pass
  // here on whatever SVG sits inside the ref'd wrapper.
  useLayoutEffect(() => {
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;
    applySvgColor(svg, isStroke, color, noColor);
  });

  if (CustomIcon) {
    return (
      <span
        ref={wrapperRef}
        className={`flex items-center justify-center ${className || ""}`}
        style={{ width: w, height: h }}
      >
        <CustomIcon size={w ?? h} />
      </span>
    );
  }

  const image = getImageSrc(name, themeType, scale);
  const preferRaster = iconFormat === "png";

  // A raster only renders crisply up to the density it was authored for;
  // bundled PNGs top out at @2x. `image.scale` is the matched raster's density
  // (absent for host-provided overrides, which we trust at any scale). When
  // the requested `scale` exceeds it, an upscaled bitmap would look soft.
  const rasterCoversScale =
    image !== null &&
    !image.isSvg &&
    (image.scale === undefined || image.scale >= scale);

  // Default (`iconFormat: "svg"`): the bundled SVG component wins whenever it
  // exists, so `getImageSrc` (host URL override / bundled PNG) is only reached
  // when no SVG matches. Raster mode (`iconFormat: "png"`): a scale-appropriate
  // PNG takes priority, but the bundled SVG is used as a fallback both for
  // names that ship no raster variant AND when the requested scale exceeds the
  // densest bundled PNG — the vector stays crisp where an upscaled bitmap
  // would blur. Host component overrides (`CustomIcon`) always win over both.
  if (BundledIcon && !(preferRaster && rasterCoversScale)) {
    return (
      <span
        ref={wrapperRef}
        className={`flex items-center justify-center ${className || ""}`}
        style={{ width: w, height: h }}
      >
        <BundledIcon width={w} height={h} />
      </span>
    );
  }

  if (!image) {
    return null;
  }

  // Host-overridden SVG URL (no bundled component matched). Keep the
  // react-svg path so host-supplied URL SVGs continue to themable; this
  // code path doesn't fire for bundled icons after the SVGR migration.
  if (image.isSvg) {
    return (
      <ReactSVG
        src={image.src}
        className={`flex items-center justify-center ${className || ""}`}
        beforeInjection={(svg) => applySvgColor(svg, isStroke, color, noColor)}
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

const Icon = memo(IconComponent);
export { Icon };
