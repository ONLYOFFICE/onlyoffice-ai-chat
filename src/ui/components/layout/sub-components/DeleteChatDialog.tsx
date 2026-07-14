import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useStores } from "../../../store/context";
import { useComponents } from "../../../providers/ComponentsProvider";
import { Dialog } from "../../dialog";

type DeleteChatDialogProps = {
  id: string;
  onClose: VoidFunction;
};

const DeleteChatDialog = ({ id, onClose }: DeleteChatDialogProps) => {
  const { DialogContent, DialogFooter } = useComponents();
  const { useThreadsStore } = useStores();
  const onDeleteThread = useThreadsStore((s) => s.onDeleteThread);
  const { t } = useI18n();

  const onSubmitAction = React.useCallback(async () => {
    await onDeleteThread(id);
    onClose();
  }, [id, onDeleteThread, onClose]);

  // Handle keyboard events
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmitAction();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSubmitAction]);

  return (
    <Dialog open={true}>
      <DialogContent header={t("Warning")} onClose={onClose} withWarningIcon>
        <div className="flex flex-col justify-between h-full">
          <p className="select-none h-[40px] flex items-center leading-[var(--lh-16)] text-[var(--text-normal)]">
            {t("WantDeleteChat")}
          </p>
          <DialogFooter
            className="h-[48px]"
            cancelLabel={t("No")}
            onCancel={onClose}
            submitLabel={t("Yes")}
            onSubmit={onSubmitAction}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { DeleteChatDialog };
