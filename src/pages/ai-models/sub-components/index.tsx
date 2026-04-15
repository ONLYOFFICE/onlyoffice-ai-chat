import { useState } from "react";
import { useI18n } from "../../../locales";
import { useComponents } from "../../../components-provider";
import { ModelCard } from "../../../components/model-card";
import { AddModelCard } from "../../../components/model-config-cards";
import { useStores } from "../../../store/context";

export const Models = () => {
  const { Button } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();
  const { profiles } = useProfilesStore();
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  return (
    <div className="flex flex-col gap-[16px] select-none">
      {isAddCardOpen ? (
        <AddModelCard onClose={() => setIsAddCardOpen(false)} isHorizontal />
      ) : (
        <Button className="self-start" onClick={() => setIsAddCardOpen(true)}>
          {t("AddModel")}
        </Button>
      )}

      <div className="flex flex-col gap-[16px]">
        {profiles.map((profile) => (
          <ModelCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  );
};
