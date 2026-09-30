import { useWidgetConfig } from "../../../../widget-config";

/**
 * Host-provided content rendered at the very top of a new (empty) chat,
 * above the welcome/viewport.
 *
 * Tied to the empty thread only, not to the chips: a header may introduce
 * suggestions that are still being fetched, or say something about the chat
 * that stands on its own. Whether it makes sense without them is the host's
 * call — passing no node is how it opts out.
 */
const SuggestionsHeader = () => {
  const { suggestionsHeader } = useWidgetConfig();

  if (!suggestionsHeader) return null;

  return (
    <div
      data-testid="suggestions-header"
      className="mx-auto w-full max-w-[var(--thread-max-width)] px-[12px] pt-[12px]"
    >
      {suggestionsHeader}
    </div>
  );
};

export { SuggestionsHeader };
