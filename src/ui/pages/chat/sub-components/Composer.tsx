import { ComposerPrimitive, useComposerRuntime } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { FileItem } from "../../../components/file-item";
import { PendingFileItem } from "../../../components/file-item/PendingFileItem";
import { useStores } from "../../../store/context";
import { useComposerBridge } from "../../../providers/ImperativeProvider";
import { useWidgetConfig } from "../../../../widget-config";
import { ComposerAction } from "./ComposerAction";

// Coarse-pointer devices (phones, tablets) must not autofocus the input:
// focusing on mount pops the virtual keyboard over the chat before the user
// asked to type. Touch-screen laptops keep the autofocus — their primary
// pointer is still fine.
const HAS_COARSE_POINTER =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(pointer: coarse)").matches;

const Composer = () => {
  const {
    useAttachmentsStore,
    useProfilesStore,
    selectCurrentChatProfile,
    useMessageStore,
  } = useStores();
  const attachmentFiles = useAttachmentsStore((s) => s.attachmentFiles);
  const attachmentImages = useAttachmentsStore((s) => s.attachmentImages);
  const pendingAttachments = useAttachmentsStore((s) => s.pendingAttachments);
  const cancelPendingAttachment = useAttachmentsStore(
    (s) => s.cancelPendingAttachment
  );
  const hasPending = pendingAttachments.length > 0;
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
    <div className="relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-[var(--chat-composer-wrapper-gap,8px)] px-[var(--chat-composer-wrapper-padding-x,12px)] pb-[var(--chat-composer-wrapper-padding-bottom,4px)]">
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
        {attachmentFiles.length ||
        attachmentImages.length ||
        pendingAttachments.length ? (
          <div className="flex flex-row gap-[8px] overflow-x-auto">
            {attachmentFiles.map((file) => (
              <FileItem key={file.id} file={file} />
            ))}
            {attachmentImages.map((image) => (
              <FileItem key={image.id} file={image} />
            ))}
            {/* Loading chips last: the settled prefix of the row never
                moves as uploads land, so only the tail reflows. Keyed by
                the client-generated lease id — filenames collide on
                duplicate picks, and an index would recycle DOM state onto
                a different file after a mid-batch failure. */}
            {pendingAttachments.map((item) => (
              <PendingFileItem
                key={item.id}
                item={item}
                onCancel={cancelPendingAttachment}
              />
            ))}
          </div>
        ) : null}

        <ComposerPrimitive.Input
          placeholder={composerPlaceholder ?? t("AskAnything")}
          className="composer-input max-h-[calc(50vh)] min-h-[var(--chat-input-min-height,20px)] w-full resize-none outline-none select-text px-[4px]"
          rows={1}
          autoFocus={!HAS_COARSE_POINTER}
          aria-label={t("MessageInput")}
          disabled={!currentProfile || composerDisabled}
          data-testid="composer-input"
          onKeyDown={(e) => {
            // `hasPending`: sending mid-upload would silently drop the
            // attachment the user just watched appear — `onNew` reads only
            // the settled refs. The Enter path bypasses the Send button's
            // disabled state, so it needs its own guard.
            if (
              (isStreamRunning || hasPending) &&
              e.key === "Enter" &&
              !e.shiftKey
            ) {
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
