import { useImages } from "../../providers/ImagesProvider";
import { useI18n } from "../../providers/LocalesProvider";
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
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "flex items-center justify-center w-[32px] h-[32px] bg-[var(--model-card-logo-background)] rounded-[var(--model-card-logo-border-radius)] border border-[var(--model-card-logo-border-color)] shrink-0",
        className
      )}
    >
      <img
        src={getProviderImageSrc(providerType, themeType)}
        alt={t("ModelLogo")}
        width={18}
        height={18}
      />
    </div>
  );
};
