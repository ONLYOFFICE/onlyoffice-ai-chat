import { useCallback } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import { Dialog } from "../../../components/dialog";
import type { ContextRoom } from "../../../../core/storage";

export const CONNECT_ROOM_DIALOG_CLASS =
  "!w-[480px] [&>div:last-child]:!px-[24px] [&>div:nth-child(2)]:!h-[52px] [&>div:nth-child(2)]:!ps-[24px] [&>div:nth-child(2)]:!pe-[8px] [&>div:nth-child(2)]:!py-[12px]";

type ConnectRoomDialogProps = {
  cloud: string;
  room: ContextRoom;
  onConfirm: VoidFunction;
  onClose: VoidFunction;
};

/**
 * Confirmation shown before a room becomes the chat's context. Picking a
 * room hands the model everything configured inside it, so the menu never
 * connects one straight from the row — the user reads what they are about
 * to share and says so.
 */
const ConnectRoomDialog = ({
  cloud,
  room,
  onConfirm,
  onClose,
}: ConnectRoomDialogProps) => {
  const { DialogContent, DialogFooter } = useComponents();
  const { t } = useI18n();

  const confirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("ConnectRoomTitle")}
        onClose={onClose}
        className={CONNECT_ROOM_DIALOG_CLASS}
      >
        <div
          className="flex flex-col justify-between h-full"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // A focused footer button already handles Enter as its own
            // click; taking over here would turn Enter on "Cancel" into a
            // connect.
            if (e.target instanceof Element && e.target.closest("button")) {
              return;
            }
            e.preventDefault();
            confirm();
          }}
        >
          <div className="flex flex-col gap-[12px] py-[var(--connect-room-dialog-body-padding-y,24px)] leading-[var(--lh-16)]">
            <p
              dir="auto"
              className="font-semibold truncate text-[var(--text-normal)]"
              data-testid="connect-room-name"
            >
              {room.name}
            </p>
            <p className="text-[var(--text-secondary)]">
              {t("ConnectRoomSource")}:{" "}
              <span
                dir="auto"
                className="text-[var(--text-normal)]"
                data-testid="connect-room-source"
              >
                {cloud}
              </span>
            </p>
            <p className="text-[var(--text-normal)]">
              {t("ConnectRoomDescription")}
            </p>
          </div>
          <DialogFooter
            className="h-[64px] mx-[-24px] px-[24px]"
            cancelLabel={t("Cancel")}
            onCancel={onClose}
            submitLabel={t("Connect")}
            onSubmit={confirm}
            buttonClassName="h-[36px]"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { ConnectRoomDialog };
