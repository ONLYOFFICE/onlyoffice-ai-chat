import { ComposerPrimitive, useComposerRuntime } from "@assistant-ui/react";
import { useEffect } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { FileItem } from "../../../components/file-item";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import { useComposerBridge } from "../../../providers/ImperativeProvider";
import { ComposerAction } from "./ComposerAction";
import { SelectModel } from "./ComposerActionSelectModel";

const Composer = () => {
  const { useAttachmentsStore, useProfilesStore, selectCurrentChatProfile } =
    useStores();
  const attachmentFiles = useAttachmentsStore((s) => s.attachmentFiles);
  const attachmentImages = useAttachmentsStore((s) => s.attachmentImages);
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { hideProfilePicker, entityId } = useWidgetConfig();
  const { t } = useI18n();
  const composerRuntime = useComposerRuntime();
  const composerBridge = useComposerBridge();

  useEffect(() => {
    if (!composerBridge) return;
    composerBridge.current.setText = (text: string) => {
      composerRuntime.setText(text);
    };
    return () => {
      if (composerBridge.current.setText) {
        composerBridge.current.setText = null;
      }
    };
  }, [composerBridge, composerRuntime]);
  // In entity ("room") mode the chat profile is fixed by the host —
  // the composer selector would let the user override it locally,
  // which contradicts the contract. Always hide.
  const shouldHidePicker = hideProfilePicker || entityId !== undefined;

  return (
    <div className="relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-[8px] px-[var(--thread-padding-x)] pb-[16px]">
      <ComposerPrimitive.Root className="composer-root relative flex w-full flex-col gap-[16px] rounded-[16px] border px-[24px] py-[16px] box-border">
        {!shouldHidePicker ? (
          <div className="flex items-center gap-[4px]">
            <span className="text-[14px] leading-[20px] text-[var(--text-tertiary)] select-none">
              {t("Ask")}
            </span>
            <SelectModel />
          </div>
        ) : null}

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
          placeholder={t("AskAI")}
          className="composer-input max-h-[calc(50vh)] min-h-[16px] w-full resize-none outline-none"
          rows={1}
          autoFocus
          aria-label="Message input"
          disabled={!currentProfile}
          data-testid="composer-input"
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
      <p className="text-center font-normal text-[12px] leading-[16px] text-[var(--text-tertiary)]">
        {t("CheckInfo")}
      </p>
    </div>
  );
};

export { Composer };
