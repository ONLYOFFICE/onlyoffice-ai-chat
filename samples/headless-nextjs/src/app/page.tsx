"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

export default function Home() {
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    import("@/components/App").then((m) => setApp(() => m.default));
  }, []);

  if (!App) return null;
  return <App />;
}
