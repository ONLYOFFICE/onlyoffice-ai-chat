import React from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { CapabilitiesUI } from "../../../../capabilities";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";
import type { DropDownItemProps } from "../../../components/dropdown-item/DropDownItem.types";
import type { ProfilePickerAction } from "../profile-picker-actions";
import type { Profile } from "../../../../types";

const SelectModel = () => {
  const { ComboBox, IconButton } = useComponents();
  const { profilePickerActions, onProfilePickerSelect, modelSelectorArrowIcon } = useWidgetConfig();
  const { useProfilesStore, selectCurrentChatProfile } = useStores();
  const profiles = useProfilesStore((s) => s.profiles);
  const setSessionChatProfile = useProfilesStore(
    (s) => s.setSessionChatProfile
  );
  const getProfileById = useProfilesStore((s) => s.getProfileById);
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
    (profile: Profile, opts?: { persistAssignment?: boolean }) => {
      // Compare the name too: the same profile can be active under an
      // action's alias (e.g. an agent name), and re-picking the plain
      // profile row must restore its own name.
      if (
        currentProfile?.id === profile.id &&
        currentProfile?.name === profile.name
      )
        return;
      setSessionChatProfile(profile, opts);
    },
    [currentProfile, setSessionChatProfile]
  );

  React.useEffect(() => {
    if (!currentProfile && chatProfiles.length > 0) {
      onSelectProfile(chatProfiles[0]);
    }
  }, [currentProfile, chatProfiles, onSelectProfile]);

  const items = React.useMemo(() => {
    const profileItems: DropDownItemProps[] = chatProfiles.map((p) => ({
      text: p.name,
      id: p.id,
      onClick: () => {
        // Explicit user pick only — the auto-select effect above goes
        // through onSelectProfile directly and must neither notify the
        // host nor touch the persisted Chat assignment. The store skips
        // the persist when the widget is entity-scoped.
        onSelectProfile(p, { persistAssignment: true });
        onProfilePickerSelect?.(p);
      },
      // Name is compared too so the plain profile row is not marked while
      // the profile is active under an action's alias.
      checked: p.id === currentProfile?.id && p.name === currentProfile?.name,
    }));

    if (!profilePickerActions?.length) return profileItems;

    const toItem = (action: ProfilePickerAction): DropDownItemProps => ({
      id: action.id,
      text: action.text,
      icon:
        typeof action.icon === "string" ? (
          <IconButton iconName={action.icon} size={24} disableHover />
        ) : (
          action.icon
        ),
      checked:
        !!action.profileId &&
        currentProfile?.id === action.profileId &&
        currentProfile?.name === action.text,
      onClick: () => {
        // A row with a submenu only navigates; it never fires handlers.
        if (action.items?.length) return;
        if (action.profileId) {
          const profile = getProfileById(action.profileId);
          // Select the underlying profile but display the action's own
          // label (e.g. an agent name) as the picker value; the profile id
          // is what every request carries.
          if (profile) {
            const aliased = { ...profile, name: action.text };
            setSessionChatProfile(aliased);
            onProfilePickerSelect?.(aliased, action.id);
          }
        }
        void action.onClick?.();
      },
      subMenu: action.items?.length ? action.items.map(toItem) : undefined,
    });

    return [
      ...profileItems,
      {
        text: "",
        onClick: () => {
          // ignore
        },
        isSeparator: true,
      },
      ...profilePickerActions.map(toItem),
    ];
  }, [
    chatProfiles,
    currentProfile,
    onSelectProfile,
    onProfilePickerSelect,
    profilePickerActions,
    getProfileById,
    setSessionChatProfile,
    IconButton,
  ]);

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
