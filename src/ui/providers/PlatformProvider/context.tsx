import { createContext, useContext } from "react";
import type { PlatformAdapter } from "./types";

const PlatformContext = createContext<PlatformAdapter | null>(null);

/** Access the current PlatformAdapter instance from any component */
export function usePlatform(): PlatformAdapter {
  const ctx = useContext(PlatformContext);
  if (!ctx)
    throw new Error("usePlatform() must be used inside <PlatformProvider>");
  return ctx;
}

/**
 * Like {@link usePlatform}, but returns `null` outside a `PlatformProvider`
 * instead of throwing — for components that stay useful without a host
 * adapter and only consult it for optional hooks.
 */
export function useOptionalPlatform(): PlatformAdapter | null {
  return useContext(PlatformContext);
}

interface PlatformProviderProps {
  /** Platform implementation. Required — no default provided */
  platform: PlatformAdapter;
  children: React.ReactNode;
}

/**
 * Provides platform-specific operations (file ops, process runner, environment, host tools).
 */
export function PlatformProvider({
  platform,
  children,
}: PlatformProviderProps) {
  return (
    <PlatformContext.Provider value={platform}>
      {children}
    </PlatformContext.Provider>
  );
}
