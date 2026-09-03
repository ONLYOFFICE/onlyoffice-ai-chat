import React, { useState } from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { useWidgetConfig } from "../../../widget-config";
import { useStores } from "../../store/context";
import { useComponents } from "../../providers/ComponentsProvider";
import { Dialog } from "../dialog";
import { Icon } from "../icon";
import { readToolIntent } from "../../../shared/tool-intent";
import { useToolCallSource } from "../tool-fallback/use-tool-source";

type ManageToolDialogProps = {
  onAllow: (allowAlways: boolean) => void;
  onDeny: () => void;
  onClose: () => void;
};

const ManageToolDialog = ({
  onAllow,
  onDeny,
  onClose,
}: ManageToolDialogProps) => {
  const { Checkbox, DialogContent, DialogFooter } = useComponents();
  const { t } = useI18n();
  const { hideToolAllowAlways } = useWidgetConfig();
  const { useServersStore } = useStores();
  const manageToolData = useServersStore((s) => s.manageToolData);
  // `true` once "Allow" is clicked, while the tool result is being resolved.
  // The dialog stays mounted in this pending state (driven by `useMessages`)
  // until the host's `onToolCallApproveResult` callback settles, then closes.
  const isApprovingTool = useServersStore((s) => s.isApprovingTool);

  const [isAllowAlways, setIsAllowAlways] = useState(false);

  const onAllowAction = React.useCallback(() => {
    if (isApprovingTool) return;
    // Closing is owned by the approve flow: it dismisses the dialog
    // immediately when no result callback is wired, or after the callback
    // settles when one is. We must not close here or the pending state and
    // the callback never get a chance to run.
    onAllow(isAllowAlways);
  }, [onAllow, isAllowAlways, isApprovingTool]);

  const onDenyAction = () => {
    if (isApprovingTool) return;
    onDeny();
    onClose();
  };

  const toolCall = manageToolData?.message?.content[manageToolData.idx];

  const toolName =
    toolCall &&
    typeof toolCall === "object" &&
    "type" in toolCall &&
    toolCall.type === "tool-call"
      ? toolCall.toolName
      : undefined;

  // Tool label and "Source:" line — resolved the same way the tool-call card
  // in the thread does it.
  const { name, displayName, sourceLabel } = useToolCallSource(toolName ?? "");

  // Resolve whether the "Always allow" checkbox is hidden for this tool.
  // `true` hides it for every tool; a string[] hides it only when the tool
  // matches — by full name (`type_search`) or bare name (`search`).
  const hideAllowAlways = Array.isArray(hideToolAllowAlways)
    ? toolName !== undefined &&
      hideToolAllowAlways.some(
        (name) => name === toolName || name === toolName.replace(/^[^_]+_/, "")
      )
    : Boolean(hideToolAllowAlways);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAllowAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onAllowAction]);

  if (
    !toolCall ||
    typeof toolCall !== "object" ||
    !("type" in toolCall) ||
    toolCall.type !== "tool-call"
  )
    return;

  let intent: string | undefined;
  try {
    const parsed = JSON.parse(toolCall.argsText ?? "{}");
    // Some providers wrap the real arguments in an `args` envelope.
    intent = readToolIntent(parsed?.args ? parsed.args : parsed);
  } catch {
    // Arguments may still be streaming; fall back to the tool name.
  }

  return (
    <Dialog open={true}>
      <DialogContent
        header={t("Confirmation")}
        onClose={isApprovingTool ? () => {} : onDeny}
        isHuge
      >
        <div className="flex flex-col justify-between h-full mb-[16px] text-[var(--tool-fallback-color)]">
          <p className="mt-[8px] font-[14px] font-normal text-[var(--tool-fallback-color)]">
            {t("AIWouldLikeUseThisTool")}
          </p>
          <div className="mt-[16px] flex flex-col gap-[4px]">
            <p className="font-bold text-[var(--tool-fallback-color)]">
              {displayName}
            </p>
            <p
              data-testid="tool-call-source"
              className="truncate text-[var(--text-tertiary)]"
            >
              {t("ToolCallSource")}: {sourceLabel}
            </p>
          </div>
          {/* The model's one-line description of the call (`aiChatIntent`),
              shown the way the thread card shows it; the bare tool name
              stands in when the model wrote none. */}
          <p className="my-[16px] flex items-center gap-[10px] text-[var(--tool-fallback-color)]">
            <Icon
              name="code"
              size={24}
              color="var(--tool-fallback-color)"
              isStroke
            />
            <span className="min-w-0 truncate">{intent ?? name}</span>
          </p>
          <p className="font-[14px] font-normal text-[var(--tool-fallback-color)]">
            {t("ReviewEachAction")}
          </p>
          {hideAllowAlways ? null : (
            <p
              onClick={() =>
                !isApprovingTool && setIsAllowAlways((val) => !val)
              }
              className="cursor-pointer flex items-center gap-[8px] mt-[24px] font-[14px] font-normal text-[var(--tool-fallback-color)]"
            >
              <Checkbox checked={isAllowAlways} id="allow-always-checkbox" />
              {t("AlwaysAllow")}
            </p>
          )}
        </div>
        <DialogFooter
          className="h-[64px] border-t-[1px] border-[var(--border-divider)] mx-[-32px] px-[32px]"
          cancelLabel={t("Deny")}
          onCancel={onDenyAction}
          cancelDisabled={isApprovingTool}
          submitLabel={t("Allow")}
          onSubmit={onAllowAction}
          submitLoading={isApprovingTool}
        />
      </DialogContent>
    </Dialog>
  );
};

export { ManageToolDialog };
