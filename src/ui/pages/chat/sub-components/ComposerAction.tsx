import { useWidgetConfig } from "../../../../widget-config";
import { ComposerActionAttachment } from "./ComposerActionAttachments";
import { ComposerActionPrompts } from "./ComposerActionPrompts";
import { ComposerActionSend } from "./ComposerActionSend";
import { ComposerActionSettings } from "./ComposerActionSettings";
import { SelectModel } from "./ComposerActionSelectModel";

const ComposerAction = () => {
  const { hideProfilePicker, profilePickerReadOnly, entityId } =
    useWidgetConfig();
  // An explicit `hideProfilePicker` from the host always wins. Only when
  // the host says nothing does the entity ("room") heuristic apply:
  // entity chats historically fix the profile on the host side, so the
  // picker is locked there by default. `entityId` itself is just a
  // scoping key — it no longer implies a fixed model on its own.
  // `profilePickerReadOnly` means the host wants the profile *shown* (as
  // static text), so it disables the entity default-lock.
  //
  // "Locked" rather than hidden: the picker also carries the Effort row,
  // which must stay reachable when the model cannot be changed, so the
  // menu shrinks to the current profile plus Effort instead of going away.
  const lockedPicker =
    hideProfilePicker ?? (entityId !== undefined && !profilePickerReadOnly);

  return (
    <div data-testid="composer-actions" className="relative flex flex-col">
      <div className="relative flex items-center justify-between gap-[8px] min-h-[var(--chat-input-actions-height,24px)]">
        <div className="flex items-center gap-[var(--action-gap,4px)] flex-row">
          <ComposerActionAttachment />
          <ComposerActionPrompts />
          <ComposerActionSettings />
        </div>

        <div className="flex items-center gap-[4px] flex-row min-w-0">
          <div className="min-w-0 me-[4px]">
            <SelectModel locked={lockedPicker} />
          </div>
          <ComposerActionSend />
        </div>
      </div>
    </div>
  );
};

export { ComposerAction };
