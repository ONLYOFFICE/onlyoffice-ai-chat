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
  {
    id: "custom-components",
    title: "Custom Components",
    description:
      "Override built-in UI primitives (Button, Input, ToggleButton, Loader) with custom implementations.",
    component: lazy(() =>
      import("@samples/custom-components/App").then((m) => ({
        default: m.App,
      }))
    ),
  },
  {
    id: "events-log",
    title: "Events Log",
    description:
      "Listen to all 20 chat callbacks (messages, streams, tool calls, threads, profiles, errors) and display them in a live log.",
    component: lazy(() =>
      import("@samples/events-log/App").then((m) => ({ default: m.App }))
    ),
  },
  {
    id: "imperative-api",
    title: "Imperative API",
    description:
      "Control the widget externally via ref — send messages, manage threads, navigate pages, switch profiles, and handle tool calls.",
    component: lazy(() =>
      import("@samples/imperative-api/App").then((m) => ({
        default: m.App,
      }))
    ),
  },
];
