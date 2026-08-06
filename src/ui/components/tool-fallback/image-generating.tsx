import { useId } from "react";
import { useI18n } from "../../providers/LocalesProvider";

// Placeholder shown while `generate_image` runs. A static "Creating image"
// label sits in the top-left corner; behind it a halftone field made of three
// dot layers on a shared 14-unit grid (small/medium/large dots, denser ink the
// larger). Colours come from the theme — dots paint in `currentColor` (the
// tool-card header colour) at rising opacity, over a themed surface — so it
// adapts to light/dark without hardcoded values. Each layer is revealed only
// where a soft radial "blob" (white core fading to black, used as a luminance
// mask) passes over it; the blobs slowly wander via declarative SMIL animation
// with non-multiple periods so the combined motion never resolves into a
// visible loop. The box is 16:9 — close to the height of a typical generated
// image, unlike the previous full-width square. The SVG stretches to the box
// (`preserveAspectRatio="none"`), and since the box keeps the viewBox's 16:9
// ratio the scaling stays uniform and the dots stay circular at any width.
type Blob = {
  r: number;
  cx: string;
  cy: string;
  durX: string;
  durY: string;
  pulse?: string;
};

const LAYERS: { key: string; r: number; op: number; blobs: Blob[] }[] = [
  {
    key: "s",
    r: 1,
    op: 0.22,
    blobs: [
      {
        r: 170,
        cx: "180;250;150;180",
        cy: "110;80;140;110",
        durX: "11s",
        durY: "13s",
      },
    ],
  },
  {
    key: "m",
    r: 1.7,
    op: 0.42,
    blobs: [
      {
        r: 120,
        cx: "230;150;280;230",
        cy: "100;150;70;100",
        durX: "9s",
        durY: "8s",
      },
      {
        r: 90,
        cx: "140;250;120;140",
        cy: "140;80;160;140",
        durX: "10s",
        durY: "7.5s",
      },
    ],
  },
  {
    key: "l",
    r: 2.5,
    op: 0.68,
    blobs: [
      {
        r: 75,
        cx: "250;170;280;250",
        cy: "90;150;110;90",
        durX: "7s",
        durY: "8.5s",
        pulse: "75;100;70;75",
      },
    ],
  },
];

const firstValue = (values: string) => values.split(";")[0];

export const ImageGeneratingPlaceholder = () => {
  const { t } = useI18n();
  const uid = useId();
  const animate = !window.matchMedia?.("(prefers-reduced-motion: reduce)")
    ?.matches;

  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden rounded-[8px] bg-[var(--chat-message-tool-call-body-background-color)] text-[var(--chat-message-tool-call-header-color)]">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 400 225"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {LAYERS.map((layer) => (
            <pattern
              key={layer.key}
              id={`${uid}-dots-${layer.key}`}
              width={14}
              height={14}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={7}
                cy={7}
                r={layer.r}
                fill="currentColor"
                fillOpacity={layer.op}
              />
            </pattern>
          ))}

          <radialGradient id={`${uid}-blob`}>
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#8a8a8a" />
            <stop offset="1" stopColor="#000000" />
          </radialGradient>

          {LAYERS.map((layer) => (
            <mask key={layer.key} id={`${uid}-mask-${layer.key}`}>
              <rect width="400" height="225" fill="#000000" />
              {layer.blobs.map((blob, i) => (
                <circle
                  key={i}
                  r={blob.r}
                  cx={firstValue(blob.cx)}
                  cy={firstValue(blob.cy)}
                  fill={`url(#${uid}-blob)`}
                >
                  {animate ? (
                    <>
                      <animate
                        attributeName="cx"
                        values={blob.cx}
                        dur={blob.durX}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="cy"
                        values={blob.cy}
                        dur={blob.durY}
                        repeatCount="indefinite"
                      />
                      {blob.pulse ? (
                        <animate
                          attributeName="r"
                          values={blob.pulse}
                          dur="6s"
                          repeatCount="indefinite"
                        />
                      ) : null}
                    </>
                  ) : null}
                </circle>
              ))}
            </mask>
          ))}
        </defs>

        {LAYERS.map((layer) => (
          <rect
            key={layer.key}
            width="400"
            height="225"
            fill={`url(#${uid}-dots-${layer.key})`}
            mask={`url(#${uid}-mask-${layer.key})`}
          />
        ))}
      </svg>

      <span className="absolute top-[8px] start-[8px] text-[12px] font-medium">
        {t("CreatingImage")}
      </span>
    </div>
  );
};
