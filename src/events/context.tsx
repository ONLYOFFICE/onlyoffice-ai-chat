import { createContext, useContext, useEffect, useMemo } from "react";
import type { ChatCallbacks } from "./types";
import type { CallbacksManager } from "./callbacks";

interface EventsContextValue {
  callbacksManager: CallbacksManager;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export interface EventsProviderProps {
  callbacksManager: CallbacksManager;
  callbacks?: ChatCallbacks;
  children: React.ReactNode;
}

export const EventsProvider = ({
  callbacksManager,
  callbacks,
  children,
}: EventsProviderProps) => {
  useEffect(() => {
    callbacksManager.setCallbacks(callbacks ?? {});
  }, [callbacksManager, callbacks]);

  const value = useMemo<EventsContextValue>(
    () => ({ callbacksManager }),
    [callbacksManager]
  );

  return (
    <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
  );
};

export const useCallbacksManager = (): CallbacksManager => {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error("useCallbacksManager must be used within EventsProvider");
  }
  return ctx.callbacksManager;
};
