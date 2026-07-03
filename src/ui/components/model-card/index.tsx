import React from "react";
import { useI18n } from "../../providers/LocalesProvider";
import { cn } from "../../../shared/utils";
import type { Profile } from "../../../types";
import { useComponents } from "../../providers/ComponentsProvider";
import { useStores } from "../../store/context";
import { useWidgetConfig } from "../../../widget-config";
import logger from "../../../shared/logger";
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
  const { useProfilesStore } = useStores();
  const { onDeleteProfile } = useWidgetConfig();
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const providerName = profile.isCloudProvider
    ? new URL(profile.baseUrl).hostname
    : (getProvider(profile.providerType)?.getName() ?? profile.providerType);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const { t, isRTL } = useI18n();

  // When the host supplies `onDeleteProfile`, it owns the confirmation step
  // (its own modal); the widget only performs the deletion once the host
  // resolves truthy. Otherwise fall back to the built-in confirm dialog.
  const requestDelete = React.useCallback(async () => {
    if (!onDeleteProfile) {
      setIsDeleteOpen(true);
      return;
    }
    try {
      const confirmed = await onDeleteProfile(profile);
      if (!confirmed) return;
      await deleteProfile(profile.id);
    } catch (err) {
      logger.error("onDeleteProfile handler failed:", err);
    }
  }, [onDeleteProfile, deleteProfile, profile]);

  const [isOpen, setIsOpen] = React.useState(false);

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
          onDelete={requestDelete}
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
        "flex justify-between gap-[8px] p-[8px] w-full rounded-[var(--model-card-border-radius)] bg-[var(--model-card-background-color)] border border-[var(--model-card-border-color)]",
        isRTL ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[8px] min-w-0 flex-1",
          isRTL ? "flex-row-reverse" : "flex-row"
        )}
      >
        <ProviderLogo providerType={profile.providerType} />
        <div className="flex flex-col overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-normal text-[var(--model-card-color)] truncate">
                {profile?.name}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom">{profile?.name}</TooltipContent>
          </Tooltip>
          <p
            className={cn(
              "text-fs-10 leading-[var(--lh-14)] text-[var(--model-card-description-color)] truncate",
              isRTL ? "text-end" : ""
            )}
          >
            {providerName}
          </p>
        </div>
      </div>
      {!isReadOnly && (
        <div className="flex items-center justify-end">
          <DropdownMenu
            onOpenChange={setIsOpen}
            trigger={<IconButton iconName="more" size={24} isActive={isOpen} />}
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
                // Selecting "Edit" swaps this card into <EditModelCard>,
                // which unmounts the dropdown. Doing that synchronously yanks
                // the Radix menu out mid-close: the trigger stays highlighted
                // (onOpenChange never lands) and the modal scroll-lock cleanup
                // is skipped, mispositioning the menu on the next open. Close
                // the menu first, then enter edit mode on the next tick.
                onClick: () => {
                  setIsOpen(false);
                  setTimeout(onStartEdit, 0);
                },
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
                onClick: requestDelete,
              },
            ]}
            sideOffset={0}
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
