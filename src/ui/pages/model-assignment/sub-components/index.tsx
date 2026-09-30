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
  const formAnalysisProfile = useProfilesStore((s) => s.formAnalysisProfile);
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
  const setFormAnalysisProfile = useProfilesStore(
    (s) => s.setFormAnalysisProfile
  );

  const defaultItems = profiles.map((p) => ({
    text: p.name,
    id: p.id,
    "data-testid": "model-assignment-option",
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
      "data-testid": "model-assignment-option-default",
      onClick: () => setter(null),
    },
    ...filterByCapability(requiredCap).map((p) => ({
      text: p.name,
      id: p.id,
      "data-testid": "model-assignment-option",
      onClick: () => setter(p),
    })),
  ];

  const hasDefaultSetup = Boolean(defaultSetupHeader);

  const defaultModelField = (
    <FieldContainer
      data-testid="model-assignment-default-field"
      header={defaultModelLabel ?? t("DefaultModel")}
      isHorizontal={!hasDefaultSetup}
      reserveErrorSpace={false}
      className={
        hasDefaultSetup
          ? undefined
          : "mb-[var(--model-assignment-default-margin-bottom,20px)]"
      }
      headerClassName="font-bold"
    >
      <ComboBox
        className="w-full"
        placeholder={t("SelectProvider")}
        value={defaultProfile?.name ?? ""}
        items={defaultItems}
        data-testid="model-assignment-default-select"
      />
    </FieldContainer>
  );

  return (
    <div data-testid="model-assignment" className="w-full">
      <p className="font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)] mb-[var(--model-assignment-description-margin-bottom,24px)]">
        {t("ModelAssignmentDescription")}
      </p>
      <div className="flex flex-col">
        {hasDefaultSetup ? (
          <div className="default-ai-setup flex flex-col mb-[var(--model-assignment-default-margin-bottom,20px)]">
            {defaultSetupHeader}
            {defaultModelField}
          </div>
        ) : (
          defaultModelField
        )}

        <p className="select-none font-bold leading-[var(--lh-18)] text-[var(--settings-header-color)] mb-[var(--model-assignment-tasks-header-margin-bottom,8px)]">
          {t("OverrideForTasks")}
        </p>
        <p className="select-none font-normal leading-[var(--lh-16)] text-[var(--settings-description-color)] mb-[var(--model-assignment-tasks-description-margin-bottom,16px)]">
          {t("OverrideForTasksDescription")}
        </p>

        <FieldContainer
          data-testid="model-assignment-chat-field"
          header={t("AIChat")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="ask-ai"
          iconIsStroke
        >
          <ComboBox
            className="w-full"
            value={chatProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-chat-select"
            items={taskItems(setChatProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-code-field"
          header={t("Code")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="code.small"
          iconIsStroke
        >
          <ComboBox
            className="w-full"
            value={codeProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-code-select"
            items={taskItems(setCodeProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-summarization-field"
          header={t("Summarization")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="summarization"
          iconIsStroke
        >
          <ComboBox
            className="w-full"
            value={summarizationProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-summarization-select"
            items={taskItems(setSummarizationProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-translation-field"
          header={t("Translation")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="translation"
        >
          <ComboBox
            className="w-full"
            value={translationProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-translation-select"
            items={taskItems(setTranslationProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-text-analysis-field"
          header={t("TextAnalysis")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="text-analysis-ai"
        >
          <ComboBox
            className="w-full"
            value={textAnalysisProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-text-analysis-select"
            items={taskItems(setTextAnalysisProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-image-generation-field"
          header={t("ImageGeneration")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="image-generation"
        >
          <ComboBox
            className="w-full"
            value={imageGenerationProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-image-generation-select"
            items={taskItems(setImageGenerationProfile, CapabilitiesUI.Image)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-ocr-field"
          header={t("OCR")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="ocr"
        >
          <ComboBox
            className="w-full"
            value={ocrProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-ocr-select"
            items={taskItems(setOcrProfile, CapabilitiesUI.Vision)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-vision-field"
          header={t("Vision")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="vision-ai"
        >
          <ComboBox
            className="w-full"
            value={visionProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-vision-select"
            items={taskItems(setVisionProfile, CapabilitiesUI.Vision)}
          />
        </FieldContainer>

        <FieldContainer
          data-testid="model-assignment-form-analysis-field"
          header={t("FormAnalysis")}
          isHorizontal
          reserveErrorSpace={false}
          className="mb-[var(--model-assignment-task-margin-bottom,12px)]"
          icon="text-analysis-ai"
        >
          <ComboBox
            className="w-full"
            value={formAnalysisProfile?.name ?? t("DefaultModel")}
            data-testid="model-assignment-form-analysis-select"
            items={taskItems(setFormAnalysisProfile, CapabilitiesUI.Chat)}
          />
        </FieldContainer>
      </div>
    </div>
  );
};

export { ModelAssignment };
