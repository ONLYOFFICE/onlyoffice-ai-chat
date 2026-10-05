import {
  type CSSProperties,
  type ImgHTMLAttributes,
  type SyntheticEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../../shared/utils";

type BoundedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "style"> & {
  /**
   * CSS custom property holding the height cap, e.g.
   * `--chat-message-tool-call-image-max-height`. Read by the browser, not here, so a
   * host theme that overrides it is honoured.
   */
  maxHeightVar: string;
};

/**
 * An image capped in height that keeps its proportions and never grows past
 * its container.
 *
 * `max-width: 100%` and `max-height` on one `<img>` do not compose: when a
 * picture violates both, CSS 2.1 §10.4 clamps each axis on its own and a
 * portrait page renders as a wide strip. Here the width cap is derived from
 * the height cap and the picture's own ratio once it has loaded —
 * `min(100%, cap × ratio)` — so at most one axis is ever clamped and the
 * other follows the ratio. Until the ratio is known the width cap alone
 * applies, which is what the first paint needs anyway.
 */
export const BoundedImage = ({
  maxHeightVar,
  className,
  onLoad,
  ...props
}: BoundedImageProps) => {
  const ref = useRef<HTMLImageElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  const readRatio = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  // A cached or data-URL picture can be complete before React attaches the
  // load listener; read it on mount as well.
  useLayoutEffect(() => {
    const img = ref.current;
    if (img?.complete) readRatio(img);
  }, [readRatio]);

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    readRatio(event.currentTarget);
    onLoad?.(event);
  };

  const style: CSSProperties = {
    maxHeight: `var(${maxHeightVar})`,
    ...(ratio
      ? { maxWidth: `min(100%, calc(var(${maxHeightVar}) * ${ratio}))` }
      : {}),
  };

  return (
    // biome-ignore lint/a11y/useAltText: `alt` comes in through props
    <img
      {...props}
      ref={ref}
      onLoad={handleLoad}
      className={cn("block h-auto w-auto max-w-full", className)}
      style={style}
    />
  );
};
