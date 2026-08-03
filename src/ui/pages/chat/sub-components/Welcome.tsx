import { ThreadPrimitive } from "@assistant-ui/react";
import { useI18n } from "../../../providers/LocalesProvider";
import { useWidgetConfig } from "../../../../widget-config";

const ThreadWelcome = () => {
  const { t } = useI18n();
  const { showWelcome, welcomeTitle, welcomeDescription } = useWidgetConfig();

  if (!showWelcome) return null;

  return (
    <ThreadPrimitive.Empty>
      <div className="welcome-container mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col px-[var(--thread-padding-x)] justify-center items-center mb-[16px]">
        <div className="max-w-[490px] flex flex-col items-center gap-[16px] text-center">
          <p
            className="welcome-title font-[700] text-fs-32 leading-[var(--lh-24)]"
            style={{ color: "var(--chat-welcome-color)" }}
          >
            {welcomeTitle ?? t("WelcomeTitle")}
          </p>
          <p
            className="text-fs-20 welcome-description"
            style={{ color: "var(--chat-welcome-description-color)" }}
          >
            {welcomeDescription ?? t("WelcomeDescription")}
          </p>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};

export { ThreadWelcome };
