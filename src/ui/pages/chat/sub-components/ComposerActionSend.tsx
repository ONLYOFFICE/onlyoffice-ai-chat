import {
  ComposerPrimitive,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
} from "@assistant-ui/react";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";

// The button box is sized from `size` (24x24 by default) while the glyph keeps
// `composerActionSendSize` via the width/height overrides — so the accent fill
// has padding around the arrow instead of hugging it. `disabled:opacity` comes
// from IconButton itself.
const BUTTON_STYLES =
  "rounded-[4px] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shrink-0 bg-[var(--chat-composer-action-send-background-color)] hover:enabled:bg-[var(--chat-composer-action-send-background-hover-color)] active:enabled:bg-[var(--chat-composer-action-send-background-pressed-color)]";

const ComposerActionSend = () => {
  const { IconButton } = useComponents();
  const { t } = useI18n();
  const {
    useAttachmentsStore,
    useMessageStore,
    useProfilesStore,
    selectCurrentChatProfile,
  } = useStores();
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  // Sending while an attachment is still uploading would silently drop it —
  // `onNew` reads only the settled refs — so Send waits for the chips.
  const hasPending = useAttachmentsStore(
    (s) => s.pendingAttachments.length > 0
  );
  const hasAttachments = useAttachmentsStore(
    (s) => s.attachmentFiles.length > 0 || s.attachmentImages.length > 0
  );
  const { composerActionSendSize = 17, composerActionSendBoxSize = 24 } =
    useWidgetConfig();
  const composerRuntime = useComposerRuntime();
  const hasText = useComposer((s) => s.text.trim().length > 0);
  // `ComposerPrimitive.Send`'s built-in disabled state gates on the
  // assistant-ui runtime's own `composer.isEmpty` (text + its *own*
  // attachment list), which never sees our custom `useAttachmentsStore` —
  // so a file-only draft would look "empty" to it and the button would
  // stay unclickable however this prop is set. We drive Send manually
  // instead, allowing either text or a settled attachment/image.

  return isStreamRunning ? (
    <ComposerPrimitive.Cancel asChild>
      <IconButton
        iconName="stop"
        size={composerActionSendBoxSize}
        className={BUTTON_STYLES}
        width={composerActionSendSize}
        height={composerActionSendSize}
        color="var(--chat-composer-action-send-color)"
        data-testid="stop-button"
      />
    </ComposerPrimitive.Cancel>
  ) : (
    <ThreadPrimitive.If running={false}>
      <IconButton
        iconName="send"
        size={composerActionSendBoxSize}
        width={composerActionSendSize}
        height={composerActionSendSize}
        color="var(--chat-composer-action-send-color)"
        className={BUTTON_STYLES}
        title={hasPending ? t("Uploading") : undefined}
        data-testid="send-button"
        disabled={
          !currentProfile || hasPending || (!hasText && !hasAttachments)
        }
        onClick={(e) => {
          // `IconButton` hardcodes `type="button"`, so this click never
          // reaches the form on its own. Submit the composer rather than
          // calling `send()` directly: the form's `onSubmit` is the one
          // place a sent prompt is recorded into ↑/↓ history, and going
          // around it drops every mouse/touch send from the list.
          const form = e.currentTarget.closest("form");
          if (form) {
            form.requestSubmit();
            return;
          }
          composerRuntime.send();
        }}
      />
    </ThreadPrimitive.If>
  );
};

export { ComposerActionSend };
