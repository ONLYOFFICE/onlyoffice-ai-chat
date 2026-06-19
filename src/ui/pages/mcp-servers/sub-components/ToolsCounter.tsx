import { useI18n } from "../../../providers/LocalesProvider";
import {
  MAX_TOOL_COUNT,
  MAX_TOOL_COUNT_WITH_WEB_SEARCH,
} from "../../../../config";
import { useStores } from "../../../store/context";

const TOOLS_COUNTER_THRESHOLD = 90;

const ToolsCounter = () => {
  const { t } = useI18n();
  const { useServersStore } = useStores();
  const tools = useServersStore((s) => s.tools);
  const webSearchEnabled = useServersStore((s) => s.webSearchEnabled);

  const allToolsCount = webSearchEnabled ? tools.length - 2 : tools.length;
  const maxCount = webSearchEnabled
    ? MAX_TOOL_COUNT_WITH_WEB_SEARCH - 2
    : MAX_TOOL_COUNT;

  if (allToolsCount <= TOOLS_COUNTER_THRESHOLD) return null;

  return (
    <p className="font-normal leading-[var(--lh-16)] text-[var(--servers-available-tools-sub-header-color)]">
      <span className="text-[var(--servers-available-tools-current-tool-color)]">
        {allToolsCount}
      </span>
      /{maxCount} {t("Tools")}
    </p>
  );
};

export default ToolsCounter;
