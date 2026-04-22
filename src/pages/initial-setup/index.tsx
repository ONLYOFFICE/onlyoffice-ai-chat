import { useState } from "react";
import { useI18n } from "../../locales";
import { useComponents } from "../../components-provider";
import { ModelCard } from "../../components/model-card";
import { AddModelCard } from "../../components/model-config-cards";
import { useStores } from "../../store/context";

type ActiveCard = null | "add" | { editingProfileId: string };

const InitialSetup = () => {
  const { Button } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();
  const { profiles } = useProfilesStore();
  // Only one Add or Edit card may be open at a time across the whole list.
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const isAddCardOpen = activeCard === "add";

  return (
    <div className="flex h-full w-full bg-[var(--layout-background-color)]">
      <div className="w-full max-w-[560px] flex flex-col">
        <h1 className="select-none text-[20px] font-bold leading-[28px] text-[var(--settings-header-color)] mb-[24px]">
          {t("AIModels")}
        </h1>
        <p className="select-none leading-[20px] text-[var(--settings-description-color)] mb-[16px]">
          {t("AIModelsDescription")}
        </p>

        {isAddCardOpen ? (
          <AddModelCard onClose={() => setActiveCard(null)} isHorizontal />
        ) : (
          <Button
            className="self-start mb-[16px]"
            onClick={() => setActiveCard("add")}
          >
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
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;
