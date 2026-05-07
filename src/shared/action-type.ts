export const ActionType = {
  Default: "Default",
  Chat: "Chat",
  Code: "Code",
  Summarization: "Summarization",
  Translation: "Translation",
  TextAnalyze: "TextAnalyze",
  ImageGeneration: "ImageGeneration",
  OCR: "OCR",
  Vision: "Vision",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];
