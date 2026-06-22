import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";

const BUTTON_STYLES =
  "rounded-[4px] cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-[var(--chat-composer-action-send-background-color)] hover:enabled:bg-[var(--chat-composer-action-send-background-hover-color)] active:enabled:bg-[var(--chat-composer-action-send-background-pressed-color)] disabled:opacity-[0.5]";

const ComposerActionSend = () => {
  const { IconButton } = useComponents();
  const { useMessageStore, useProfilesStore, selectCurrentChatProfile } =
    useStores();
  const isStreamRunning = useMessageStore((s) => s.isStreamRunning);
  const currentProfile = useProfilesStore(selectCurrentChatProfile);

  return isStreamRunning ? (
    <ComposerPrimitive.Cancel asChild>
      <IconButton
        iconName="stop"
        size={17}
        className={BUTTON_STYLES}
        width={17}
        height={17}
        data-testid="stop-button"
      />
    </ComposerPrimitive.Cancel>
  ) : (
    <ThreadPrimitive.If running={false}>
      <ComposerPrimitive.Send asChild disabled={!currentProfile}>
        <IconButton
          iconName="send"
          size={17}
          width={17}
          height={17}
          color="var(--chat-composer-action-send-color)"
          className={BUTTON_STYLES}
          data-testid="send-button"
        />
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>
  );
};

export { ComposerActionSend };
