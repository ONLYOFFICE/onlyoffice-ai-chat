import { lazy } from "react";

export interface Demo {
  id: string;
  title: string;
  description: string;
  component: React.LazyExoticComponent<() => React.JSX.Element>;
}

export const demos: Demo[] = [
  {
    id: "basic",
    title: "Basic",
    description:
      "Minimal full-page chat widget with IndexedDB storage, localStorage settings, and system theme detection.",
    component: lazy(() =>
      import("@samples/basic/App").then((m) => ({ default: m.App }))
    ),
  },
  {
    id: "custom-locales",
    title: "Custom Locales",
    description:
      "Locale switcher with 42 built-in languages and a custom EN locale with all 130 translation keys overridden.",
    component: lazy(() =>
      import("@samples/custom-locales/App").then((m) => ({ default: m.App }))
    ),
  },
  {
    id: "custom-themes",
    title: "Custom Themes",
    description:
      "Theme switcher between 7 built-in themes and a custom purple/indigo theme with token viewer.",
    component: lazy(() =>
      import("@samples/custom-themes/App").then((m) => ({ default: m.App }))
    ),
  },
];
