import * as ToastPrimitive from "@radix-ui/react-toast";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useOptionalPlatform } from "../../../providers/PlatformProvider";
import { useOptionalTheme } from "../../../providers/ThemeProvider";
import { ToastContent } from "./ToastContent";

import "../Toast.css";

/** How long a toast stays up before it closes itself. */
export const DEFAULT_TOAST_DURATION = 3000;

type ToastItem = {
  id: number;
  title: ReactNode;
  duration: number;
  open: boolean;
};

export type ShowToastOptions = {
  /** Milliseconds the toast stays up. Defaults to {@link DEFAULT_TOAST_DURATION}. */
  duration?: number;
};

type ToastContextValue = {
  /** Queue a toast. Returns its id so a caller can dismiss it early. */
  showToast: (title: ReactNode, options?: ShowToastOptions) => number;
  /** Close a toast before its duration elapses. */
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export type ToastProviderProps = {
  children: ReactNode;
  /** Default lifetime for toasts queued without an explicit duration. */
  duration?: number;
  /**
   * Where the stack sits. The editors' chat is a narrow panel, so the default
   * is bottom-centre just above the composer — see `--toast-viewport-*`.
   */
  className?: string;
};

/**
 * Hosts the toast stack for everything below it.
 *
 * Nesting is a no-op: when a provider is already mounted above, this renders
 * `children` and nothing else, so the outer stack stays the single viewport.
 * That lets both `AIChatWidget` and `ChatPage` mount one unconditionally — a
 * host assembling its own tree out of the exported pages still gets toasts,
 * without the two paths producing two competing viewports.
 */
const ToastProvider = ({ children, ...props }: ToastProviderProps) => {
  const existing = useContext(ToastContext);
  if (existing) return <>{children}</>;
  return <ToastProviderImpl {...props}>{children}</ToastProviderImpl>;
};

const ToastProviderImpl = ({
  children,
  duration = DEFAULT_TOAST_DURATION,
  className,
}: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const portalContainer = useOptionalTheme()?.portalContainer ?? null;

  const dismissToast = useCallback((id: number) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, open: false } : toast
      )
    );
  }, []);

  const showToast = useCallback(
    (title: ReactNode, options?: ShowToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current,
        {
          id,
          title,
          duration: options?.duration ?? duration,
          open: true,
        },
      ]);
      return id;
    },
    [duration]
  );

  // Radix animates the close, so the item is only dropped once the exit
  // animation has finished — removing it on `onOpenChange(false)` would cut
  // the fade off mid-way.
  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast]
  );

  // The stack must live *inside* an `.aui-root`: the scoped preflight and the
  // `--fs-*` / `--lh-*` typography tokens are defined on that class, so a
  // viewport rendered as its sibling gets neither. `ThemeProvider` keeps a
  // dedicated `.aui-root` container for exactly this — dialogs, dropdowns and
  // tooltips already portal into it.
  const viewport = (
    <ToastPrimitive.Viewport
      className={
        className ??
        "aui-toast-viewport fixed z-[9999] flex flex-col items-center gap-[8px] m-0 list-none outline-none bottom-[var(--toast-viewport-bottom,96px)] left-[var(--toast-viewport-inline,16px)] right-[var(--toast-viewport-inline,16px)]"
      }
      // The stack is an announcement, not a landmark the user tabs into;
      // Radix's default F8 hotkey would steal a key the editors use.
      hotkey={[]}
    />
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider duration={duration} swipeDirection="down">
        {children}
        {toasts.map((toast) => (
          <ToastContent
            key={toast.id}
            title={toast.title}
            duration={toast.duration}
            open={toast.open}
            onOpenChange={(open) => {
              if (!open) dismissToast(toast.id);
            }}
            onAnimationEnd={() => {
              if (!toast.open) removeToast(toast.id);
            }}
          />
        ))}
        {/* Falls back to rendering in-tree when no theme container is
            mounted yet (first render) or when the provider is used standalone
            in a host's own tree — a toast is never worth dropping outright. */}
        {portalContainer ? createPortal(viewport, portalContainer) : viewport}
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
};

/**
 * Queue a toast from anywhere under a {@link ToastProvider}.
 *
 * A host that supplies `PlatformAdapter.showToast` gets the toast instead of
 * the built-in stack, so its own notification system (and positioning) wins.
 * Delegation lives here rather than at the call-sites so every toast the chat
 * raises routes the same way.
 *
 * Returns no-ops when no provider is mounted, so a host embedding a single
 * page without the widget shell doesn't crash on a toast it never wanted.
 */
const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  const hostToast = useOptionalPlatform()?.showToast;

  return useMemo(() => {
    const fallback: ToastContextValue = context ?? {
      showToast: () => -1,
      dismissToast: () => undefined,
    };
    if (!hostToast) return fallback;

    return {
      showToast: (title, options) => {
        // The host slot takes a plain string. Marked-up titles can't survive
        // that, so they stay with the built-in stack rather than being
        // stringified into `[object Object]`.
        if (typeof title !== "string") return fallback.showToast(title, options);
        hostToast(title);
        // Nothing local to dismiss — the host owns the toast's lifetime.
        return -1;
      },
      dismissToast: () => undefined,
    };
  }, [context, hostToast]);
};

export { ToastProvider, useToast };
