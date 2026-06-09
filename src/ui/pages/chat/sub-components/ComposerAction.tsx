import { ComposerActionAttachment } from "./ComposerActionAttachments";
import { ComposerActionPrompts } from "./ComposerActionPrompts";
import { ComposerActionSend } from "./ComposerActionSend";

const ComposerAction = () => {
  return (
    <div className="relative flex flex-col">
      <div className="relative flex items-center justify-between h-[20px]">
        <div className="flex items-center gap-[4px] flex-row">
          <ComposerActionAttachment />
          <ComposerActionPrompts />
        </div>

        <div className="flex items-center gap-[4px] flex-row">
          <ComposerActionSend />
        </div>
      </div>
    </div>
  );
};

export { ComposerAction };
