import { ComposerPrimitive, useComposerRuntime } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { FileItem } from "../../../components/file-item";
import { PendingFileItem } from "../../../components/file-item/PendingFileItem";
import { useStores } from "../../../store/context";
import { usePromptHistory } from "../../../hooks/usePromptHistory";
import { useComposerBridge } from "../../../providers/ImperativeProvider";
import { useWidgetConfig } from "../../../../widget-config";
import { useChatPasteAttachments } from "../useChatPasteAttachments";
import { ComposerAction } from "./ComposerAction";
import { ComposerActionRoom } from "./ComposerActionRoom";

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
  const hasAttachments =
    attachmentFiles.length > 0 || attachmentImages.length > 0;
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const { t } = useI18n();
  const { composerPlaceholder, composerDisabled } = useWidgetConfig();
  const composerRuntime = useComposerRuntime();
  const composerBridge = useComposerBridge();
  const rootRef = useRef<HTMLFormElement>(null);
  const history = usePromptHistory();
  const { onPaste } = useChatPasteAttachments();

  // Set while the caret sits where a recall parked it rather than where the
  // user put it. It makes the *opposite* arrow a history step too: after an
  // Up the caret is at the start, which is not the edge a Down would normally
  // need, but there is no caret movement worth protecting inside text the
  // user never navigated — so reversing direction still costs one keypress.
  // Any real edit or caret move clears it, handing the edge rule back.
  const caretParkedByHistory = useRef(false);

  // Replace the draft with a history entry and park the caret at the edge
  // the *same* arrow would move towards next, so a second press keeps
  // walking the history instead of first moving inside the multi-line entry
  // we just pasted in: Up leaves it at the start, Down at the end.
  // `setText` re-renders the textarea, hence the post-paint placement.
  const applyHistoryText = (
    textarea: HTMLTextAreaElement,
    text: string,
    caret: "start" | "end"
  ) => {
    composerRuntime.setText(text);
    caretParkedByHistory.current = true;
    requestAnimationFrame(() => {
      const position = caret === "start" ? 0 : textarea.value.length;
      textarea.selectionStart = textarea.selectionEnd = position;
    });
  };

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
        onSubmit={(e) => {
          // assistant-ui's own submit handler no-ops when its runtime-level
          // `composer.isEmpty` is true — text blank *and* its own (unused)
          // attachment list empty. It never sees our `useAttachmentsStore`,
          // so an attachment-only draft would silently fail to submit on
          // Enter. Take over here whenever we have attachments it can't see.
          if (!currentProfile || hasPending || !hasAttachments) return;
          e.preventDefault();
          composerRuntime.send();
        }}
        inert={composerDisabled}
        aria-disabled={composerDisabled || undefined}
        className={`composer-root relative flex w-full flex-col gap-[6px] rounded-[4px] border px-[var(--chat-composer-padding-x,8px)] pt-[var(--chat-composer-padding-top,10px)] pb-[var(--chat-composer-padding-bottom,6px)] box-border ${
          composerDisabled
            ? "composer-disabled pointer-events-none cursor-not-allowed opacity-60"
            : "cursor-text"
        }`}
      >
        <ComposerActionRoom />
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
          className="composer-input max-h-[var(--chat-input-max-height,50vh)] min-h-[var(--chat-input-min-height,20px)] w-full resize-none outline-none select-text px-[4px]"
          rows={1}
          autoFocus={!HAS_COARSE_POINTER}
          aria-label={t("MessageInput")}
          disabled={!currentProfile || composerDisabled}
          data-testid="composer-input"
          onPaste={(e) => {
            void onPaste(e);
          }}
          // Clicking or dragging places the caret with no keydown to hear,
          // so the parked-caret flag would otherwise go stale and hand the
          // next arrow to history from a spot the user chose themselves.
          onMouseDown={() => {
            caretParkedByHistory.current = false;
          }}
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
              return;
            }

            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
              // Any other key is the user typing or moving around — if
              // they edit a recalled entry it becomes their own draft
              // again, so stop treating the next Up as a continued walk.
              // Bare modifiers and navigation keys don't change the text,
              // so they must not abandon the walk either.
              if (
                e.key.length === 1 ||
                e.key === "Backspace" ||
                e.key === "Delete"
              ) {
                history.reset();
              }
              // Whatever the key did, the caret is no longer parked purely
              // by us — Home/End/click-through all move it deliberately.
              caretParkedByHistory.current = false;
              return;
            }

            const textarea = e.currentTarget;
            // Terminal rule: history only claims the arrow when it isn't
            // stealing caret movement the user meant — an empty box, or
            // the caret already parked at the edge it would move towards.
            // A selection means they're manipulating text, not navigating.
            // A caret we parked ourselves counts as at-edge for either
            // arrow, so reversing direction mid-walk isn't charged a
            // keypress just to cross text the user never navigated into.
            const atEdge =
              textarea.selectionStart === textarea.selectionEnd &&
              (textarea.value === "" ||
                caretParkedByHistory.current ||
                (e.key === "ArrowUp"
                  ? textarea.selectionStart === 0
                  : textarea.selectionEnd === textarea.value.length));
            if (!atEdge) return;

            // Claimed before the step is known: walking off the top of the
            // loaded window has to fetch the page before it, and by the
            // time that resolves the event is long past being cancellable.
            // The caret is already at the edge the arrow moves towards, so
            // the only movement being suppressed is a no-op anyway.
            e.preventDefault();
            const isUp = e.key === "ArrowUp";
            const step = isUp
              ? history.previous(textarea.value)
              : history.next();
            void step.then((result) => {
              // `null` = history had nothing to offer here.
              if (result) {
                applyHistoryText(textarea, result.text, isUp ? "start" : "end");
              }
            });
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
