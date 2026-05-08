import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * Bridge between the imperative widget ref (lives at the widget root) and
 * the `Composer` (lives inside `AssistantRuntimeProvider`, where the
 * composer runtime is accessible). The composer registers its `setText`
 * implementation on mount; the imperative API reads it on demand.
 */
export type ComposerBridge = {
  setText: ((text: string) => void) | null;
};

type ComposerBridgeRef = { current: ComposerBridge };

const ComposerBridgeContext = createContext<ComposerBridgeRef | null>(null);

export const ComposerBridgeProvider = ({
  children,
  bridgeRef,
}: {
  children: ReactNode;
  bridgeRef?: ComposerBridgeRef;
}) => {
  const localRef = useRef<ComposerBridge>({ setText: null });
  const value = useMemo(() => bridgeRef ?? localRef, [bridgeRef]);
  return (
    <ComposerBridgeContext.Provider value={value}>
      {children}
    </ComposerBridgeContext.Provider>
  );
};

/**
 * Returns the shared bridge ref. Returns `null` if not wrapped in the
 * provider, so callers can no-op gracefully (e.g. tests).
 */
export const useComposerBridge = (): ComposerBridgeRef | null =>
  useContext(ComposerBridgeContext);
