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
    <div className="aui-root flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px] flex flex-col m-[12px] overflow-hidden select-none">
        <AddModelCard
          variant="standalone"
          isHorizontal={isAddModelCardHorizontal}
        />

        <div className="flex flex-col gap-[8px]">
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
