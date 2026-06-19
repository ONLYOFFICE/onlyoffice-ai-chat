import { useWidgetConfig } from "../../../../widget-config";

/**
 * Host-provided content rendered at the very top of a new (empty) chat,
 * above the welcome/viewport. Shown only when suggestions are visible
 * (same gate as {@link Suggestions}).
 */
const SuggestionsHeader = () => {
  const { suggestions, suggestionsHeader } = useWidgetConfig();

  if (!suggestions?.length || !suggestionsHeader) return null;

  return (
    <div className="mx-auto w-full max-w-[var(--thread-max-width)] px-[12px] pt-[12px]">
      {suggestionsHeader}
    </div>
  );
};

export { SuggestionsHeader };
