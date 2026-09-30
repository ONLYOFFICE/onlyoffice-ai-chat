import { useState } from "react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useComponents } from "../../../providers/ComponentsProvider";
import { ModelCard } from "../../../components/model-card";
import { AddModelCard } from "../../../components/model-config-cards";
import { useStores } from "../../../store/context";
import { useWidgetConfig } from "../../../../widget-config";

interface ModelsProps {
  isAddModelCardHorizontal?: boolean;
}

type ActiveCard = null | "add" | { editingProfileId: string };

export const Models = ({ isAddModelCardHorizontal }: ModelsProps) => {
  const { Button } = useComponents();
  const { t } = useI18n();
  const { onOpenCustomProvider } = useWidgetConfig();
  const { useProfilesStore } = useStores();
  const profiles = useProfilesStore((s) => s.profiles);
  // Only one Add or Edit card may be open at a time across the whole list.
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const isAddCardOpen = activeCard === "add";

  return (
    <div className="flex flex-col gap-[var(--ai-models-content-gap,8px)] select-none">
      {isAddCardOpen ? (
        <AddModelCard
          onClose={() => setActiveCard(null)}
          isHorizontal={isAddModelCardHorizontal}
        />
      ) : (
        <div className="flex gap-[var(--ai-models-actions-gap,8px)] self-start">
          <Button
            data-testid="ai-models-add-button"
            onClick={() => setActiveCard("add")}
          >
            {t("AddModel")}
          </Button>
          {onOpenCustomProvider && (
            <Button
              variant="default"
              data-testid="ai-models-custom-providers-button"
              onClick={onOpenCustomProvider}
            >
              {t("CustomProviders")}
            </Button>
          )}
        </div>
      )}

      <div
        data-testid="ai-models-list"
        className="flex flex-col gap-[var(--ai-models-list-gap,8px)]"
      >
        {profiles.map((profile) => (
          <ModelCard
            key={profile.id}
            profile={profile}
            isEditing={
              typeof activeCard === "object" &&
              activeCard?.editingProfileId === profile.id
            }
            onStartEdit={() => setActiveCard({ editingProfileId: profile.id })}
            onStopEdit={() => setActiveCard(null)}
            isEditModelCardHorizontal={isAddModelCardHorizontal}
          />
        ))}
      </div>
    </div>
  );
};
