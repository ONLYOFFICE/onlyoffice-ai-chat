/**
 * Maps logical setting names to their storage key strings.
 *
 * The library never hard-codes storage keys directly — it reads them from
 * a `StoreKeys` object so the host application can namespace or rename keys
 * without touching library internals. Each property value is the actual
 * string key written to the {@link SettingsAdapter}.
 */
export interface StoreKeys {
  defaultProfile: string;
  chatProfile: string;
  summarizationProfile: string;
  translationProfile: string;
  textAnalysisProfile: string;
  imageGenerationProfile: string;
  ocrProfile: string;
  visionProfile: string;
  deepMode: string;
  mcpServers: string;
  disabledTools: string;
  systemPromptAppendix: string;
}

/** Maximum number of MCP / host tools that may be active at once */
export const MAX_TOOL_COUNT = 100;

/** Same limit as {@link MAX_TOOL_COUNT} but with two extra slots reserved for the built-in web-search tools */
export const MAX_TOOL_COUNT_WITH_WEB_SEARCH = MAX_TOOL_COUNT + 2;
