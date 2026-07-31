import { useEffect, useRef } from "react";
import { useI18n } from "../../providers/LocalesProvider";

// Placeholder shown while `generate_image` runs. A static "Creating image"
// label sits in a clean strip on top; below it a halftone field made of three
// dot layers (small/medium/large dots, denser ink the larger). Colours come
// from the theme — dots paint in `currentColor` (the message text colour) at
// rising opacity, over a themed surface — so it adapts to light/dark without
// hardcoded values. Each layer is revealed only through a soft radial "blob"
// mask; the three blobs slowly wander along Lissajous paths with per-axis
// periods in the 7–13s range, deliberately not integer multiples of one
// another, so the combined motion never resolves into a visible loop. Dots are
// sized in CSS pixels (fixed at any card width); a ResizeObserver feeds the
// live pixel size to the single rAF loop and keeps the SVG's viewBox 1:1 with
// it so the pattern fills the whole card.
const BLOBS = [
  { fx: 0.5, fy: 0.5, ax: 0.48, ay: 0.5, px: 7000, py: 11000, phx: 0.0, phy: 1.7 },
  { fx: 0.5, fy: 0.5, ax: 0.5, ay: 0.46, px: 13000, py: 8000, phx: 2.3, phy: 0.6 },
  { fx: 0.5, fy: 0.5, ax: 0.46, ay: 0.48, px: 9000, py: 12000, phx: 4.1, phy: 3.2 },
];

const LAYERS = [
  { key: "s", tile: 8, r: 1, op: 0.22 },
  { key: "m", tile: 12, r: 1.7, op: 0.42 },
  { key: "l", tile: 17, r: 2.5, op: 0.68 },
];

export const ImageGeneratingPlaceholder = () => {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const blobRefs = useRef<(SVGRadialGradientElement | null)[]>([]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let w = 0;
    let h = 0;
    const measure = () => {
      w = svg.clientWidth || 0;
      h = svg.clientHeight || 0;
      // Keep the coordinate system 1:1 with pixels so `%` fills the whole box
      // and the dot radii stay fixed-size at any card width.
      if (w > 0 && h > 0) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    };
    measure();

    const apply = (elapsed: number) => {
      if (w <= 0 || h <= 0) return;
      const r = Math.max(w, h) * 0.9;
      for (let i = 0; i < BLOBS.length; i++) {
        const el = blobRefs.current[i];
        if (!el) continue;
        const b = BLOBS[i];
        const cx = w * (b.fx + b.ax * Math.sin((2 * Math.PI * elapsed) / b.px + b.phx));
        const cy = h * (b.fy + b.ay * Math.sin((2 * Math.PI * elapsed) / b.py + b.phy));
        el.setAttribute("cx", cx.toFixed(1));
        el.setAttribute("cy", cy.toFixed(1));
        el.setAttribute("r", r.toFixed(1));
      }
    };

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    const ro = new ResizeObserver(() => {
      measure();
      if (reduce) apply(4000);
    });
    ro.observe(svg);

    if (reduce) {
      apply(4000);
      return () => ro.disconnect();
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      apply(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full aspect-square overflow-hidden rounded-[8px] bg-[var(--chat-message-tool-call-body-background-color)] text-[var(--chat-message-tool-call-header-color)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[44px]">
        <svg ref={svgRef} className="h-full w-full" aria-hidden="true">
          <defs>
            {LAYERS.map((layer) => (
              <pattern
                key={layer.key}
                id={`ig-dots-${layer.key}`}
                width={layer.tile}
                height={layer.tile}
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx={layer.tile / 2}
                  cy={layer.tile / 2}
                  r={layer.r}
                  fill="currentColor"
                  fillOpacity={layer.op}
                />
              </pattern>
            ))}

            {LAYERS.map((layer, i) => (
              <radialGradient
                key={layer.key}
                id={`ig-blob-${layer.key}`}
                gradientUnits="userSpaceOnUse"
                cx={0}
                cy={0}
                r={0}
                ref={(el) => {
                  blobRefs.current[i] = el;
                }}
              >
                <stop offset="0" stopColor="#fff" stopOpacity="1" />
                <stop offset="0.6" stopColor="#fff" stopOpacity="0.6" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            ))}

            {LAYERS.map((layer) => (
              <mask key={layer.key} id={`ig-mask-${layer.key}`}>
                <rect
                  width="100%"
                  height="100%"
                  fill={`url(#ig-blob-${layer.key})`}
                />
              </mask>
            ))}
          </defs>

          {LAYERS.map((layer) => (
            <rect
              key={layer.key}
              width="100%"
              height="100%"
              fill={`url(#ig-dots-${layer.key})`}
              mask={`url(#ig-mask-${layer.key})`}
            />
          ))}
        </svg>
      </div>

      <span className="absolute top-[8px] start-[8px] text-[12px] font-medium">
        {t("CreatingImage")}
      </span>
    </div>
  );
};
