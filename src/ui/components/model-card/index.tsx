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
import { DeleteProfileDialog } from "./DeleteProfileDialog";
import { getProviderName } from "../../../core/providers";

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
  const { DropdownMenu, IconButton } = useComponents();
  const { useProfilesStore } = useStores();
  const { onDeleteProfile } = useWidgetConfig();
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const providerName = profile.isCloudProvider
    ? new URL(profile.baseUrl).hostname
    : getProviderName(profile.providerType);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const { t } = useI18n();

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
      data-testid="model-card"
      data-profile-id={profile.id}
      className={cn(
        "flex justify-between gap-[var(--model-card-gap,8px)] p-[var(--model-card-padding,8px)] w-full rounded-[var(--model-card-border-radius)] bg-[var(--model-card-background-color)] border border-[var(--model-card-border-color)]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[var(--model-card-content-gap,8px)] min-w-0 flex-1"
        )}
      >
        <ProviderLogo providerType={profile.providerType} />
        {/* Each line sits in its own flex row so `justify-content: flex-start`
            (which follows the ambient `dir`) parks a short label at the reading
            start — right in RTL, left in LTR — mirroring the ComboBox trigger.
            `dir="auto"` on the text picks the writing direction from the
            content so the ellipsis lands at the string's own end: LTR model IDs
            truncate on the right, not the head. `min-w-0` lets long labels
            shrink and truncate instead of overflowing. */}
        <div className="flex flex-col min-w-0 overflow-hidden">
          <div className="flex min-w-0">
            <p
              dir="auto"
              data-testid="model-card-name"
              className="min-w-0 font-normal text-[var(--model-card-color)] truncate"
            >
              {profile?.name}
            </p>
          </div>
          <div className="flex min-w-0">
            <p
              dir="auto"
              data-testid="model-card-provider"
              className={cn(
                "min-w-0 text-fs-10 leading-[var(--lh-14)] text-[var(--model-card-description-color)] truncate"
              )}
            >
              {providerName}
            </p>
          </div>
        </div>
      </div>
      {!isReadOnly && (
        <div className="flex items-center justify-end">
          <DropdownMenu
            onOpenChange={setIsOpen}
            trigger={
              <IconButton
                iconName="more"
                size={24}
                isActive={isOpen}
                data-testid="model-card-menu-button"
              />
            }
            data-testid="model-card-menu"
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
                "data-testid": "model-card-menu-edit",
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
                "data-testid": "model-card-menu-delete",
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
