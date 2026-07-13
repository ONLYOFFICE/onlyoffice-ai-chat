import { useWidgetConfig } from "../../../../widget-config";
import { ComposerActionAttachment } from "./ComposerActionAttachments";
import { ComposerActionPrompts } from "./ComposerActionPrompts";
import { ComposerActionSend } from "./ComposerActionSend";
import { SelectModel } from "./ComposerActionSelectModel";

const ComposerAction = () => {
  const { hideProfilePicker, entityId } = useWidgetConfig();
  // In entity ("room") mode the chat profile is fixed by the host —
  // the composer selector would let the user override it locally,
  // which contradicts the contract. Always hide.
  const shouldHidePicker = hideProfilePicker || entityId !== undefined;

  return (
    <div className="relative flex flex-col">
      <div className="relative flex items-center justify-between gap-[8px] h-[20px]">
        <div className="flex items-center gap-[4px] flex-row">
          <ComposerActionAttachment />
          <ComposerActionPrompts />
        </div>

        <div className="flex items-center gap-[4px] flex-row min-w-0">
          {!shouldHidePicker ? (
            <div className="min-w-0 me-[4px]">
              <SelectModel />
            </div>
          ) : null}
          <ComposerActionSend />
        </div>
      </div>
    </div>
  );
};

export { ComposerAction };
