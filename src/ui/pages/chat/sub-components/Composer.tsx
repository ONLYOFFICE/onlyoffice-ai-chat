import { ComposerPrimitive, useComposerRuntime } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { FileItem } from "../../../components/file-item";
import { useStores } from "../../../store/context";
import { useComposerBridge } from "../../../providers/ImperativeProvider";
import { useWidgetConfig } from "../../../../widget-config";
import { ComposerAction } from "./ComposerAction";

const Composer = () => {
  const {
    useAttachmentsStore,
    useProfilesStore,
    selectCurrentChatProfile,
    useMessageStore,
  } = useStores();
  const attachmentFiles = useAttachmentsStore((s) => s.attachmentFiles);
  const attachmentImages = useAttachmentsStore((s) => s.attachmentImages);
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const { t } = useI18n();
  const { composerPlaceholder, composerDisabled } = useWidgetConfig();
  const composerRuntime = useComposerRuntime();
  const composerBridge = useComposerBridge();
  const rootRef = useRef<HTMLFormElement>(null);

  // Make the whole composer area act as one big click target: a click on the
  // padding or any non-interactive gap focuses the textarea. Clicks that land
  // on a real control (buttons, the model selector, the input itself) are left
  // alone so they keep their own behavior.
  const focusInputOnClick = (e: ReactMouseEvent<HTMLFormElement>) => {
    if (composerDisabled) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, textarea, select, [role='button'], [role='combobox'], [contenteditable='true']"
      )
    ) {
      return;
    }
    rootRef.current?.querySelector("textarea")?.focus();
  };

  useEffect(() => {
    if (!composerBridge) return;
    const bridge = composerBridge.current;
    bridge.setText = (text: string) => {
      composerRuntime.setText(text);
    };
    return () => {
      if (bridge.setText) {
        bridge.setText = null;
      }
    };
  }, [composerBridge, composerRuntime]);

  return (
    <div className="relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-[8px] px-[var(--chat-composer-wrapper-padding-x,12px)] pb-[var(--chat-composer-wrapper-padding-bottom,4px)]">
      <ComposerPrimitive.Root
        ref={rootRef}
        onClick={focusInputOnClick}
        inert={composerDisabled}
        aria-disabled={composerDisabled || undefined}
        className={`composer-root relative flex w-full flex-col gap-[6px] rounded-[4px] border px-[var(--chat-composer-padding-x,8px)] pt-[var(--chat-composer-padding-top,10px)] pb-[var(--chat-composer-padding-bottom,6px)] box-border ${
          composerDisabled
            ? "composer-disabled pointer-events-none cursor-not-allowed opacity-60"
            : "cursor-text"
        }`}
      >
        {attachmentFiles.length || attachmentImages.length ? (
          <div className="flex flex-row gap-[8px] overflow-x-auto">
            {attachmentFiles.map((file) => (
              <FileItem key={file.id} file={file} />
            ))}
            {attachmentImages.map((image) => (
              <FileItem key={image.id} file={image} />
            ))}
          </div>
        ) : null}

        <ComposerPrimitive.Input
          placeholder={composerPlaceholder ?? t("AskAnything")}
          className="composer-input max-h-[calc(50vh)] min-h-[var(--chat-input-min-height,20px)] w-full resize-none outline-none select-text px-[4px]"
          rows={1}
          autoFocus
          aria-label="Message input"
          disabled={!currentProfile || composerDisabled}
          data-testid="composer-input"
          onKeyDown={(e) => {
            if (isStreamRunning && e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
            }
          }}
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
      <p className="text-center font-normal text-[length:var(--chat-composer-disclaimer-font-size,var(--fs-10,10px))] leading-[var(--lh-16)] text-[var(--text-tertiary)]">
        {t("CheckInfo")}
      </p>
    </div>
  );
};

export { Composer };
