import { cn } from "../../../shared/utils";

export type LoaderProps = {
  className?: string;
  size?: number;
  /** Test hook. Defaults to `"loader"`. */
  "data-testid"?: string;
};

const Loader = ({
  className,
  size = 16,
  "data-testid": dataTestId = "loader",
}: LoaderProps) => {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-solid border-[var(--loader-border-color)] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]",
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
};

export { Loader };
