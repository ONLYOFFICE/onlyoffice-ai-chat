import React from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { cn } from "../../../shared/utils";
import type { Profile } from "../../../types";
import { useComponents } from "../../providers/ComponentsProvider";
import { EditModelCard } from "../model-config-cards";
import { ProviderLogo } from "../provider-logo";
import { Tooltip, TooltipTrigger } from "../tooltip";
import { DeleteProfileDialog } from "./DeleteProfileDialog";
import { getProvider } from "../../../core/providers";

type ModelCardProps = {
  profile: Profile;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  isEditModelCardHorizontal?: boolean;
};

const ModelCard = ({
  profile,
  isEditing,
  onStartEdit,
  onStopEdit,
  isEditModelCardHorizontal,
}: ModelCardProps) => {
  const { DropdownMenu, IconButton, TooltipContent } = useComponents();
  const providerName = profile.isCloudProvider
    ? new URL(profile.baseUrl).hostname
    : (getProvider(profile.providerType)?.getName() ?? profile.providerType);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const { t, isRTL } = useI18n();

  const [containerElement, setContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const containerRef = React.useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  // External profiles are host-managed: their transport lives in
  // PlatformAdapter.externalFetch, so editing connection fields in the
  // widget would be misleading and removing them would orphan a
  // host-side configuration. Hide both actions.
  const isReadOnly = profile.providerType === "external";

  if (isEditing && !isReadOnly) {
    return (
      <>
        <EditModelCard
          profile={profile}
          onClose={onStopEdit}
          onDelete={() => setIsDeleteOpen(true)}
          isHorizontal={isEditModelCardHorizontal}
        />
        {isDeleteOpen && (
          <DeleteProfileDialog
            profile={profile}
            onClose={() => setIsDeleteOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex justify-between gap-[12px] px-[16px] py-[12px] w-full rounded-[var(--model-card-border-radius)] bg-[var(--model-card-background-color)] border border-[var(--model-card-border-color)]",
        isRTL ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[12px] min-w-0 flex-1",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}
      >
        <ProviderLogo providerType={profile.providerType} />
        <div className="flex flex-col overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-normal text-[14px] leading-[20px] text-[var(--model-card-color)] truncate">
                {profile?.name}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom">{profile?.name}</TooltipContent>
          </Tooltip>
          <p
            className={cn(
              "text-[12px] leading-[14px] text-[var(--model-card-description-color)] truncate",
              isRTL ? "text-end" : ""
            )}
          >
            {providerName}
          </p>
        </div>
      </div>
      {!isReadOnly && (
        <div className="flex items-center justify-end" ref={containerRef}>
          <DropdownMenu
            onOpenChange={setIsOpen}
            trigger={
              <IconButton iconName="more" size={20} isActive={isOpen} />
            }
            items={[
              {
                icon: (
                  <IconButton
                    iconName="btn-edit"
                    size={20}
                    disableHover
                    isStroke
                  />
                ),
                text: t("Edit"),
                onClick: onStartEdit,
              },
              {
                text: "",
                onClick: () => {
                  // ignore
                },
                isSeparator: true,
              },
              {
                icon: (
                  <IconButton iconName="btn-remove" size={20} disableHover />
                ),
                text: t("Delete"),
                onClick: () => setIsDeleteOpen(true),
              },
            ]}
            side={isRTL ? "left" : "right"}
            align={isRTL ? "end" : "start"}
            sideOffset={0}
            containerRef={containerElement}
          />
        </div>
      )}
      {isDeleteOpen && (
        <DeleteProfileDialog
          profile={profile}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </div>
  );
};

export { ModelCard };
