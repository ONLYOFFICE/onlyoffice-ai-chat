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

const applySvgColor = (
  svg: SVGSVGElement,
  isStroke: boolean | undefined,
  color: string | undefined,
  noColor: boolean | undefined
) => {
  if (noColor) return;
  const fillColor = color || "var(--icon-button-color)";
  const attr = isStroke ? "stroke" : "fill";
  svg.querySelectorAll("path").forEach((p) => p.setAttribute(attr, fillColor));
  svg
    .querySelectorAll("circle")
    .forEach((c) => c.setAttribute(attr, fillColor));
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
  const { getImageSrc, getIconComponent, getBundledIcon } = useImages();
  const CustomIcon = getIconComponent(name);
  const BundledIcon = CustomIcon ? null : getBundledIcon(name);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Re-apply theme/color attributes whenever the bundled SVG re-renders
  // (theme switch, color prop change, name change). The SVGR-produced
  // component renders a fresh DOM tree, so attribute mutations from a
  // prior render don't carry over — we always do a clean pass here.
  useLayoutEffect(() => {
    if (!BundledIcon) return;
    const svg = wrapperRef.current?.querySelector("svg");
    if (!svg) return;
    applySvgColor(svg, isStroke, color, noColor);
  });

  if (CustomIcon) {
    return <CustomIcon size={w ?? h} className={className} />;
  }

  if (BundledIcon) {
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

  const image = getImageSrc(name, themeType, scale);
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
