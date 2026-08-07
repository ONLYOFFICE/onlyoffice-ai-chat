import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "../../providers/LocalesProvider";

// Placeholder shown while `generate_image` runs. The elapsed generation time
// sits in the top-left corner; behind it a halftone field made of three dot
// layers on a shared 14-unit grid (small/medium/large dots, denser ink the
// larger). Colours come from the theme — dots paint in `currentColor` (the
// tool-card header colour) at rising opacity, over a themed surface — so it
// adapts to light/dark without hardcoded values. Each layer is revealed only
// where a soft radial "blob" (white core fading to black, used as a luminance
// mask) passes over it; the blobs slowly wander via declarative SMIL animation
// with non-multiple periods so the combined motion never resolves into a
// visible loop. Moving the pointer over the box drops expanding rings into the
// same masks, so the halftone momentarily lights up in circles spreading from
// the cursor — water rippling under the dots. The box is 16:9 — close to the
// height of a typical generated image, unlike the previous full-width square.
// The SVG stretches to the box (`preserveAspectRatio="none"`), and since the
// box keeps the viewBox's 16:9 ratio the scaling stays uniform and the dots
// stay circular at any width.
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
    r: 0.65,
    op: 0.25,
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
    r: 1.1,
    op: 0.46,
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
    r: 1.7,
    op: 0.72,
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

// Ripple tuning. `RIPPLE_MS` must match the SMIL `dur` below — it is how long
// a ring stays mounted before it is dropped from state.
const RIPPLE_DUR = "1.6s";
const RIPPLE_MS = 1600;
// Don't spawn a ring for every pointer sample: one per 130ms and only after
// the cursor travelled far enough, otherwise a fast sweep floods the masks.
const RIPPLE_MIN_MS = 130;
const RIPPLE_MIN_DIST = 16;
const RIPPLE_MAX = 6;

type RippleState = { id: number; x: number; y: number };

// One expanding ring, rendered once per layer mask. SMIL inserted after the
// document timeline has started is treated as already finished, so the
// animations begin `indefinite` and are kicked off explicitly on mount.
const Ripple = ({ ripple, gradientId }: RippleProps) => {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    ref.current?.querySelectorAll("animate").forEach((node) => {
      if (typeof node.beginElement === "function") node.beginElement();
    });
  }, []);

  return (
    <g ref={ref} transform={`translate(${ripple.x} ${ripple.y})`}>
      <circle r={8} opacity={0} fill={`url(#${gradientId})`}>
        <animate
          attributeName="r"
          values="8;130"
          keyTimes="0;1"
          calcMode="spline"
          keySplines="0.2 0.7 0.3 1"
          dur={RIPPLE_DUR}
          begin="indefinite"
          fill="freeze"
        />
        <animate
          attributeName="opacity"
          values="0.85;0"
          keyTimes="0;1"
          calcMode="spline"
          keySplines="0.4 0 0.7 1"
          dur={RIPPLE_DUR}
          begin="indefinite"
          fill="freeze"
        />
      </circle>
    </g>
  );
};

type RippleProps = { ripple: RippleState; gradientId: string };

const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const ImageGeneratingPlaceholder = () => {
  const { t } = useI18n();
  const uid = useId();
  const animate = !window.matchMedia?.("(prefers-reduced-motion: reduce)")
    ?.matches;

  const [elapsed, setElapsed] = useState(0);
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const rippleId = useRef(0);
  const lastRipple = useRef({ x: -999, y: -999, at: -999 });
  const timers = useRef<number[]>([]);

  // Tick faster than once a second so the first digit change doesn't lag
  // behind the wall clock by up to a second.
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((performance.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    []
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!animate) return;

      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = ((event.clientX - rect.left) / rect.width) * 400;
      const y = ((event.clientY - rect.top) / rect.height) * 225;
      const at = event.timeStamp;
      const prev = lastRipple.current;

      if (at - prev.at < RIPPLE_MIN_MS) return;
      if (Math.hypot(x - prev.x, y - prev.y) < RIPPLE_MIN_DIST) return;
      lastRipple.current = { x, y, at };

      const id = rippleId.current++;
      setRipples((current) => [
        ...current.slice(-(RIPPLE_MAX - 1)),
        { id, x, y },
      ]);

      const timer = window.setTimeout(() => {
        setRipples((current) => current.filter((r) => r.id !== id));
        timers.current = timers.current.filter((entry) => entry !== timer);
      }, RIPPLE_MS);
      timers.current.push(timer);
    },
    [animate]
  );

  return (
    <div
      role="status"
      aria-label={t("CreatingImage")}
      onPointerMove={handlePointerMove}
      className="relative w-full aspect-[16/9] overflow-hidden rounded-[8px] bg-[var(--chat-message-tool-call-body-background-color)] text-[var(--chat-message-tool-call-header-color)]"
    >
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

          {/* Ring-shaped brush for the ripples. Transparent everywhere but the
              rim, so a ring only ever adds light to a mask — it never punches a
              hole in the blob underneath it. */}
          <radialGradient id={`${uid}-ring`}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.82" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
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
              {ripples.map((ripple) => (
                <Ripple
                  key={ripple.id}
                  ripple={ripple}
                  gradientId={`${uid}-ring`}
                />
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

      <span className="absolute top-[8px] start-[8px] text-[12px] font-medium tabular-nums">
        {formatElapsed(elapsed)}
      </span>
    </div>
  );
};
