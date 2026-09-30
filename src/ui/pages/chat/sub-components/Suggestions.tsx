import { useComposerRuntime } from "@assistant-ui/react";
import { useWidgetConfig } from "../../../../widget-config";
import { MAX_SUGGESTIONS } from "../suggestions";

const Suggestions = () => {
  const { suggestions } = useWidgetConfig();
  const composerRuntime = useComposerRuntime();

  if (!suggestions?.length) return null;

  const items = suggestions.slice(0, MAX_SUGGESTIONS);

  return (
    <div
      data-testid="suggestions"
      className="suggestions mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-[6px] px-[var(--chat-suggestions-px,12px)] mb-[var(--chat-suggestions-margin-bottom,16px)]"
    >
      <div className="flex flex-wrap justify-center gap-[var(--chat-suggestions-gap,6px)]">
        {items.map((suggestion, index) => (
          <button
            key={`${suggestion.name}-${index}`}
            type="button"
            data-testid="suggestion-button"
            onClick={() => composerRuntime.setText(suggestion.prompt)}
            className="inline-flex h-[var(--chat-suggestion-height,25px)] max-w-full min-w-0 items-center gap-[6px] rounded-full border border-[var(--chat-suggestion-border-color)] px-[var(--chat-suggestion-padding-x,10px)] py-[var(--chat-suggestion-padding-y,3px)] text-[var(--text-normal)] hover:bg-[var(--highlight-button-hover)]"
          >
            <span className="truncate font-normal text-fs-12 leading-[var(--lh-18)] tracking-[0px]">
              {suggestion.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export { Suggestions };
