import { createContext, useContext, useMemo } from "react";
import { defaultComponents } from "./defaults";
import type { ComponentOverrides } from "./types";

const ComponentsContext =
  createContext<Required<ComponentOverrides>>(defaultComponents);

export interface ComponentsProviderProps {
  overrides?: Partial<ComponentOverrides>;
  children: React.ReactNode;
}

export const ComponentsProvider = ({
  overrides,
  children,
}: ComponentsProviderProps) => {
  const value = useMemo(
    () =>
      overrides ? { ...defaultComponents, ...overrides } : defaultComponents,
    [overrides]
  );

  return (
    <ComponentsContext.Provider value={value}>
      {children}
    </ComponentsContext.Provider>
  );
};

export const useComponents = (): Required<ComponentOverrides> => {
  return useContext(ComponentsContext);
};
