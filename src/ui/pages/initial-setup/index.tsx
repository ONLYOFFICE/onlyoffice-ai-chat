import { useState } from "react";
import { ModelCard } from "../../components/model-card";
import { AddModelCard } from "../../components/model-config-cards";
import { useStores } from "../../store/context";
import { useWidgetConfig } from "../../../widget-config";

type ActiveCard = null | { editingProfileId: string };

const InitialSetup = () => {
  const { useProfilesStore } = useStores();
  const profiles = useProfilesStore((s) => s.profiles);
  // Defaults to horizontal so the screen feels open on first launch;
  // hosts can opt out via WidgetConfig.isAddModelCardHorizontal = false.
  const { isAddModelCardHorizontal = true } = useWidgetConfig();
  // Tracks which existing model card is being edited (the add form is always open).
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);

  return (
    <div
      data-testid="initial-setup-page"
      className="aui-root flex h-full w-full [justify-content:var(--initial-setup-justify,flex-start)] bg-[var(--layout-background-color)]"
    >
      <div className="flex-1 min-w-0 max-w-[var(--initial-setup-max-width,560px)] flex flex-col m-[var(--initial-setup-margin,12px)] overflow-hidden select-none">
        <AddModelCard
          variant="standalone"
          isHorizontal={isAddModelCardHorizontal}
        />

        <div
          data-testid="initial-setup-models-list"
          className="flex flex-col gap-[var(--initial-setup-list-gap,8px)]"
        >
          {profiles.map((profile) => (
            <ModelCard
              key={profile.id}
              profile={profile}
              isEditing={activeCard?.editingProfileId === profile.id}
              onStartEdit={() =>
                setActiveCard({ editingProfileId: profile.id })
              }
              onStopEdit={() => setActiveCard(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;
