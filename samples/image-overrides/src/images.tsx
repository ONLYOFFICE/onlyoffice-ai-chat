import type { ImageOverrides } from "@onlyoffice/ai-chat";

function CustomSettingsIcon({
  size = 16,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function CustomToolsIcon({ size = 16 }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CustomSearchIcon({
  size = 16,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export const imageOverrides: ImageOverrides = {
  "btn-settings": CustomSettingsIcon,
  tools: CustomToolsIcon,
  search: CustomSearchIcon,
};

export const overriddenIcons = [
  { name: "btn-settings", label: "Settings icon" },
  { name: "tools", label: "Tools icon" },
  { name: "search", label: "Search icon" },
];

export const allIcons = [
  "anthropic",
  "arrow.bottom",
  "arrow.bottom.big",
  "arrow.right",
  "arrow.top",
  "ask-ai",
  "attachment",
  "attention",
  "btn-close",
  "btn-close.small",
  "btn-copy",
  "btn-download",
  "btn-edit",
  "btn-extended-thinking",
  "btn-external",
  "btn-list-search",
  "btn-menu-about",
  "btn-menu-navigation",
  "btn-menu-search",
  "btn-more.small",
  "btn-previtem",
  "btn-prompt",
  "btn-remove",
  "btn-rename",
  "btn-reset",
  "btn-save",
  "btn-save.small",
  "btn-settings",
  "btn-web-search",
  "btn-zoomup",
  "checked",
  "chevron",
  "clear.search",
  "code",
  "code.small",
  "djvu",
  "documents",
  "image-generation",
  "more",
  "ocr",
  "onlyoffice",
  "openai",
  "pdf",
  "pdf-form",
  "presentations",
  "search",
  "show-chat",
  "spreadsheets",
  "status.error",
  "stop",
  "summarization",
  "text-analysis-ai",
  "tool.called",
  "tools",
  "translation",
  "unknown-format",
  "visio",
  "vision-ai",
  "xps",
];
