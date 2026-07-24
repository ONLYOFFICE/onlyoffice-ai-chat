import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { CapabilitiesUI } from "../../../../capabilities";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import type { Profile } from "../../../../types";

const SelectModel = () => {
  const { ComboBox } = useComponents();
  const { modelSelectorArrowIcon } = useWidgetConfig();
  const { useProfilesStore, selectCurrentChatProfile } = useStores();
  const profiles = useProfilesStore((s) => s.profiles);
  const setSessionChatProfile = useProfilesStore(
    (s) => s.setSessionChatProfile
  );
  const currentProfile = useProfilesStore(selectCurrentChatProfile);
  const { t } = useI18n();

  const chatProfiles = React.useMemo(
    () =>
      profiles.filter(
        (p) => !p.capabilities || (p.capabilities & CapabilitiesUI.Chat) !== 0
      ),
    [profiles]
  );

  const onSelectProfile = React.useCallback(
    (profile: Profile) => {
      if (currentProfile?.id === profile.id) return;
      setSessionChatProfile(profile);
    },
    [currentProfile, setSessionChatProfile]
  );

  React.useEffect(() => {
    if (!currentProfile && chatProfiles.length > 0) {
      onSelectProfile(chatProfiles[0]);
    }
  }, [currentProfile, chatProfiles, onSelectProfile]);

  const items = React.useMemo(
    () =>
      chatProfiles.map((p) => ({
        text: p.name,
        id: p.id,
        onClick: () => onSelectProfile(p),
        checked: p.id === currentProfile?.id,
      })),
    [chatProfiles, currentProfile, onSelectProfile]
  );

  return (
    <ComboBox
      placeholder={t("SelectModel")}
      value={currentProfile?.name ?? ""}
      items={items}
      withoutBg
      matchTriggerWidth={false}
      contentClassName="min-w-[var(--dropdown-model-selector-min-width)]"
      maxWidth="min(var(--dropdown-model-selector-max-width), var(--radix-dropdown-menu-content-available-width))"
      className="h-[22px] ps-0 pe-0 hover:bg-transparent"
      arrowIcon={modelSelectorArrowIcon ?? "arrow"}
      arrowWidth="var(--model-selector-arrow-width, 7px)"
      arrowHeight="var(--model-selector-arrow-height, 4px)"
      data-testid="model-selector"
    />
  );
};

export { SelectModel };
