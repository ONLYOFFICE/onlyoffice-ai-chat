import { useImages } from "../../providers/ImagesProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { cn } from "../../../shared/utils";
import type { ProviderType } from "../../../types";

type ProviderLogoProps = {
  providerType: ProviderType;
  className?: string;
};

export const ProviderLogo = ({
  providerType,
  className,
}: ProviderLogoProps) => {
  const { getProviderImageSrc } = useImages();
  const { themeType } = useTheme();

  return (
    <div
      className={cn(
        "flex items-center justify-center w-[var(--model-card-logo-size)] h-[var(--model-card-logo-size)] bg-[var(--model-card-logo-background)] rounded-[var(--model-card-logo-border-radius)] border border-[var(--model-card-logo-border-color)] shrink-0",
        className
      )}
    >
      <img
        src={getProviderImageSrc(providerType, themeType)}
        alt="model logo"
        className="w-[var(--model-card-logo-image-size)] h-[var(--model-card-logo-image-size)]"
      />
    </div>
  );
};
