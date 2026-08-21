import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
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
  const { composerActionSendSize = 17, composerActionSendBoxSize = 24 } =
    useWidgetConfig();

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
      <ComposerPrimitive.Send asChild disabled={!currentProfile || hasPending}>
        <IconButton
          iconName="send"
          size={composerActionSendBoxSize}
          width={composerActionSendSize}
          height={composerActionSendSize}
          color="var(--chat-composer-action-send-color)"
          className={BUTTON_STYLES}
          title={hasPending ? t("Uploading") : undefined}
          data-testid="send-button"
        />
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>
  );
};

export { ComposerActionSend };
