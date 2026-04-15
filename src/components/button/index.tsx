import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./Button.utils";

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(
        "cursor-pointer",
        buttonVariants({ variant, size, className })
      )}
      {...props}
    />
  );
};

export { Button };
