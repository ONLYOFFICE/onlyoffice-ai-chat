import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "../../../shared/utils";
import { buttonVariants } from "./Button.utils";

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
  };

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? Slot : "button";

  // When loading, keep the label in the layout but hidden so the button
  // doesn't resize, and overlay a centered spinner that inherits the text
  // color (currentColor). Skipped for `asChild`, where Slot needs a single
  // child and the consumer owns the markup.
  const showLoader = isLoading && !asChild;

  return (
    <Comp
      data-slot="button"
      disabled={disabled || (showLoader ? true : undefined)}
      aria-busy={showLoader || undefined}
      className={cn(
        "cursor-pointer",
        showLoader && "relative",
        buttonVariants({ variant, size, className })
      )}
      {...props}
    >
      {showLoader ? (
        <>
          <span className="invisible">{children}</span>
          <span
            aria-hidden
            className="absolute inset-0 m-auto h-[var(--button-loader-size)] w-[var(--button-loader-size)] animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"
          />
        </>
      ) : (
        children
      )}
    </Comp>
  );
};

export { Button };
