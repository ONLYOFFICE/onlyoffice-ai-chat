import { useState } from "react";
import { useI18n } from "../../../locales";
import { useComponents } from "../../../components-provider";
import { ModelCard } from "../../../components/model-card";
import { AddModelCard } from "../../../components/model-config-cards";
import { useStores } from "../../../store/context";

interface ModelsProps {
  isAddModelCardHorizontal?: boolean;
}

type ActiveCard = null | "add" | { editingProfileId: string };

export const Models = ({ isAddModelCardHorizontal }: ModelsProps) => {
  const { Button } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();
  const { profiles } = useProfilesStore();
  // Only one Add or Edit card may be open at a time across the whole list.
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const isAddCardOpen = activeCard === "add";

  return (
    <div className="flex flex-col gap-[16px] select-none">
      {isAddCardOpen ? (
        <AddModelCard
          onClose={() => setActiveCard(null)}
          isHorizontal={isAddModelCardHorizontal}
        />
      ) : (
        <Button className="self-start" onClick={() => setActiveCard("add")}>
          {t("AddModel")}
        </Button>
      )}

      <div className="flex flex-col gap-[16px]">
        {profiles.map((profile) => (
          <ModelCard
            key={profile.id}
            profile={profile}
            isEditing={
              typeof activeCard === "object" &&
              activeCard?.editingProfileId === profile.id
            }
            onStartEdit={() =>
              setActiveCard({ editingProfileId: profile.id })
            }
            onStopEdit={() => setActiveCard(null)}
            isEditModelCardHorizontal={isAddModelCardHorizontal}
          />
        ))}
      </div>
    </div>
  );
};
