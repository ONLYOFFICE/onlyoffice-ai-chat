import { useWidgetConfig } from "../../../../widget-config";

/**
 * Host-provided content rendered directly above the composer, in both the
 * empty and non-empty chat states (e.g. an "AI features aren't active"
 * banner). Spans the composer's width and is left untouched otherwise —
 * the host owns its markup and styling.
 */
const ComposerHeader = () => {
  const { composerHeader } = useWidgetConfig();

  if (!composerHeader) return null;

  return (
    <div
      data-testid="composer-header"
      className="composer-header mx-auto w-full max-w-[var(--thread-max-width)] px-[12px] mb-[12px]"
    >
      {composerHeader}
    </div>
  );
};

export { ComposerHeader };
