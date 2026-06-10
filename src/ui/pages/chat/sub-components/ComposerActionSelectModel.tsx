import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { CapabilitiesUI } from "../../../../capabilities";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";
import type { Profile } from "../../../../types";

const SelectModel = () => {
  const { ComboBox } = useComponents();
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
      className="h-[22px] ps-0 pe-0 hover:bg-transparent"
      data-testid="model-selector"
    />
  );
};

export { SelectModel };
