import { useEffect, useRef, useState } from "react";
import { cn } from "../../../shared/utils";
import { useWidgetConfig } from "../../../widget-config";
import { IconButton } from "../icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import type { HelpButtonProps } from "./HelpButton.types";

/**
 * An "i" icon that opens a hint popover on click.
 *
 * Unlike `TooltipIconButton`, which shows a hover label, this is a popover:
 * it holds interactive content (links, buttons), stays open while the pointer
 * travels from the icon into it, and closes on Escape or an outside press.
 *
 * @param props - See {@link HelpButtonProps}.
 * @returns The trigger icon and its popover.
 * @see HelpButtonProps
 */
const HelpButton = ({
  content,
  iconName = "btn-menu-about",
  size,
  side = "bottom",
  align = "start",
  sideOffset,
  className,
  triggerClassName,
  open,
  defaultOpen,
  onOpenChange,
  "aria-label": ariaLabel,
  "data-testid": dataTestId = "help-button",
}: HelpButtonProps) => {
  const { aboutButtonSize = 20 } = useWidgetConfig();
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);

  // The wrapper exists only to give the outside-press handler a node to test
  // against: `IconButton` takes no ref, and the trigger has to stay the button
  // itself so keyboard users get a real activation target.
  const triggerRef = useRef<HTMLSpanElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // A popover anchored to a row in a scrolling list must go when the list
  // scrolls: Radix repositions it, but it stays open floating over rows the
  // trigger has already left. Scroll events do not bubble, so they are
  // caught in the capture phase on the document; a scroll inside the
  // popover's own content is the reader's and is left alone.
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(`[data-testid="${dataTestId}-content"]`)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
    // `setOpen` is recreated per render but only forwards to stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dataTestId]);

  return (
    // Always driven as controlled: an uncontrolled `Tooltip` opens on hover and
    // force-closes itself when the pointer leaves the document — right for a
    // hover label, wrong for a popover the user is meant to move into.
    <Tooltip open={isOpen}>
      <span ref={triggerRef} className="inline-flex">
        <TooltipTrigger asChild>
          <IconButton
            className={cn("cursor-pointer", triggerClassName)}
            iconName={iconName}
            size={size ?? aboutButtonSize}
            disableHover
            noColor
            aria-label={ariaLabel}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            data-testid={dataTestId}
            onClick={() => setOpen(!isOpen)}
          />
        </TooltipTrigger>
      </span>
      <TooltipContent
        className={className}
        side={side}
        align={align}
        sideOffset={sideOffset}
        isAbout
        aria-label={ariaLabel}
        data-testid={`${dataTestId}-content`}
        onEscapeKeyDown={() => setOpen(false)}
        onPointerDownOutside={(event) => {
          // A press on the trigger counts as outside the popover, but the
          // trigger's own click handler already toggles it — dismissing here
          // too would close and immediately reopen it.
          if (triggerRef.current?.contains(event.target as Node)) return;
          setOpen(false);
        }}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
};

export { HelpButton };
export type { HelpButtonProps };
