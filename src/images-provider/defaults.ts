import {
  getImageSrc as getImageSrcInternal,
  getProviderImageSrc as getProviderImageSrcInternal,
} from "../lib/images";
import type { ImagesContextValue } from "./types";

export const defaultImages: ImagesContextValue = {
  getImageSrc: getImageSrcInternal,
  getIconComponent: () => null,
  getProviderImageSrc: getProviderImageSrcInternal,
};
