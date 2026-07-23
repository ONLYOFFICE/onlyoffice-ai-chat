import { useI18n } from "../../../providers/LocalesProvider";
import { CapabilitiesUI } from "../../../../capabilities";
import { useComponents } from "../../../providers/ComponentsProvider";
import { useStores } from "../../../store/context";
import type { Profile } from "../../../../types";

interface ModelAssignmentProps {
  defaultSetupHeader?: React.ReactNode;

  defaultModelLabel?: string;
}

const ModelAssignment = ({
  defaultSetupHeader,
  defaultModelLabel,
}: ModelAssignmentProps) => {
  const { ComboBox, FieldContainer } = useComponents();
  const { t } = useI18n();
  const { useProfilesStore } = useStores();
  const profiles = useProfilesStore((s) => s.profiles);
  const defaultProfile = useProfilesStore((s) => s.defaultProfile);
  const chatProfile = useProfilesStore((s) => s.chatProfile);
  const codeProfile = useProfilesStore((s) => s.codeProfile);
  const summarizationProfile = useProfilesStore((s) => s.summarizationProfile);
  const translationProfile = useProfilesStore((s) => s.translationProfile);
  const textAnalysisProfile = useProfilesStore((s) => s.textAnalysisProfile);
  const imageGenerationProfile = useProfilesStore(
    (s) => s.imageGenerationProfile
  );
  const ocrProfile = useProfilesStore((s) => s.ocrProfile);
  const visionProfile = useProfilesStore((s) => s.visionProfile);
  const setDefaultProfile = useProfilesStore((s) => s.setDefaultProfile);
  const setChatProfile = useProfilesStore((s) => s.setChatProfile);
  const setCodeProfile = useProfilesStore((s) => s.setCodeProfile);
  const setSummarizationProfile = useProfilesStore(
    (s) => s.setSummarizationProfile
  );
  const setTranslationProfile = useProfilesStore(
    (s) => s.setTranslationProfile
  );
  const setTextAnalysisProfile = useProfilesStore(
    (s) => s.setTextAnalysisProfile
  );
  const setImageGenerationProfile = useProfilesStore(
    (s) => s.setImageGenerationProfile
  );
  const setOcrProfile = useProfilesStore((s) => s.setOcrProfile);
  const setVisionProfile = useProfilesStore((s) => s.setVisionProfile);

  const defaultItems = profiles.map((p) => ({
    text: p.name,
    id: p.id,
    onClick: () => setDefaultProfile(p),
  }));

  const filterByCapability = (requiredCap: number) =>
    profiles.filter(
      (p) => !p.capabilities || (p.capabilities & requiredCap) !== 0
    );

  const taskItems = (
    setter: (p: Profile | null) => void,
    requiredCap: number
  ) => [
    {
      text: t("DefaultModel"),
      id: "default",
      onClick: () => setter(null),
    },
    ...filterByCapability(requiredCap).map((p) => ({
      text: p.name,
      id: p.id,
      onClick: () => setter(p),
    })),
  ];

  const hasDefaultSetup = Boolean(defaultSetupHeader);

  const defaultModelField = (
    <FieldContainer
      header={defaultModelLabel ?? t("DefaultModel")}
      isHorizontal={!hasDefaultSetup}
      reserveErrorSpace={false}
      className={
        hasDefaultSetup
          ? undefined
          : "mb-[var(--model-assignment-default-margin-bottom)]"
      }
      headerClassName="font-bold"
    >
      <ComboBox
        className="w-full"
        placeholder={t("SelectProvider")}
        value={defaultProfile?.name ?? ""}
        items={defaultItems}
      />
    </FieldContainer>
  );

  return (
    <div className="w-full">
      <p className="font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)] mb-[var(--model-assignment-description-margin-bottom)]">
        {t("ModelAssignmentDescription")}
      </p>
      <div className="flex flex-col">
        {hasDefaultSetup ? (
          <div className="default-ai-setup flex flex-col mb-[var(--model-assignment-default-margin-bottom)]">
            {defaultSetupHeader}
            {defaultModelField}
          </div>
        ) : (
          defaultModelField
        )}

        <p className="select-none font-bold leading-[var(--lh-18)] text-[var(--settings-header-color)] mb-[var(--model-assignment-tasks-header-margin-bottom)]">
          {t("OverrideForTasks")}
        </p>

        <FieldContainer
          header={t("AIChat")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="ask-ai"
          iconIsStroke
        >
          <ComboBox
            className="w-full"
            value={chatProfile?.name ?? t("DefaultModel")}
            items={taskItems(setChatProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Code")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="code.small"
          iconIsStroke
        >
          <ComboBox
            className="w-full"
            value={codeProfile?.name ?? t("DefaultModel")}
            items={taskItems(setCodeProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Summarization")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="summarization"
          iconIsStroke
        >
          <ComboBox
            className="w-full"
            value={summarizationProfile?.name ?? t("DefaultModel")}
            items={taskItems(setSummarizationProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Translation")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="translation"
        >
          <ComboBox
            className="w-full"
            value={translationProfile?.name ?? t("DefaultModel")}
            items={taskItems(setTranslationProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("TextAnalysis")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="text-analysis-ai"
        >
          <ComboBox
            className="w-full"
            value={textAnalysisProfile?.name ?? t("DefaultModel")}
            items={taskItems(setTextAnalysisProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("ImageGeneration")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="image-generation"
        >
          <ComboBox
            className="w-full"
            value={imageGenerationProfile?.name ?? t("DefaultModel")}
            items={taskItems(setImageGenerationProfile, CapabilitiesUI.Image)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("OCR")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="ocr"
        >
          <ComboBox
            className="w-full"
            value={ocrProfile?.name ?? t("DefaultModel")}
            items={taskItems(setOcrProfile, CapabilitiesUI.Vision)}
          />
        </FieldContainer>

        <FieldContainer
          header={t("Vision")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom)]"
          icon="vision-ai"
        >
          <ComboBox
            className="w-full"
            value={visionProfile?.name ?? t("DefaultModel")}
            items={taskItems(setVisionProfile, CapabilitiesUI.Vision)}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { ModelAssignment };
