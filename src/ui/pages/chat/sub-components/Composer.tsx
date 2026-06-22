import { ComposerPrimitive, useComposerRuntime } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { FileItem } from "../../../components/file-item";
import { useStores } from "../../../store/context";
import { useComposerBridge } from "../../../providers/ImperativeProvider";
import { ComposerAction } from "./ComposerAction";

const Composer = () => {
  const { useAttachmentsStore, useProfilesStore, selectCurrentChatProfile } =
    useStores();
  const attachmentFiles = useAttachmentsStore((s) => s.attachmentFiles);
  const attachmentImages = useAttachmentsStore((s) => s.attachmentImages);
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { t } = useI18n();
  const composerRuntime = useComposerRuntime();
  const composerBridge = useComposerBridge();
  const rootRef = useRef<HTMLFormElement>(null);

  // Make the whole composer area act as one big click target: a click on the
  // padding or any non-interactive gap focuses the textarea. Clicks that land
  // on a real control (buttons, the model selector, the input itself) are left
  // alone so they keep their own behavior.
  const focusInputOnClick = (e: ReactMouseEvent<HTMLFormElement>) => {
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
    <div className="relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-[8px] px-[12px] pb-[4px]">
      <ComposerPrimitive.Root
        ref={rootRef}
        onClick={focusInputOnClick}
        className="composer-root relative flex w-full cursor-text flex-col gap-[6px] rounded-[4px] border px-[8px] pt-[10px] pb-[6px] box-border"
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
          placeholder={t("AskAnything")}
          className="composer-input max-h-[calc(50vh)] min-h-[20px] w-full resize-none outline-none select-text px-[4px]"
          rows={1}
          autoFocus
          aria-label="Message input"
          disabled={!currentProfile}
          data-testid="composer-input"
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
      <p className="text-center font-normal text-[var(--fs-10)] leading-[var(--lh-16)] text-[var(--text-tertiary)]">
        {t("CheckInfo")}
      </p>
    </div>
  );
};

export { Composer };
