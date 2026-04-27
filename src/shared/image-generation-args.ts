export type ImageGenerationArgs = {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  signal?: AbortSignal;
};
