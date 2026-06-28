import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Re-export message utilities so components can import from lib/utils
export {
  convertMessagesToMd,
  getMessageTitleFromMd,
  removeSpecialCharacter,
} from "../utils";

// `text-fs-*` are custom font-size utilities (see ui/styles/index.css). They are
// not part of Tailwind's default config, so tailwind-merge would classify them
// as text-color classes and silently drop e.g. `text-fs-10` whenever another
// `text-[...]` color class appears in the same cn() call. Registering them in
// the `font-size` group keeps font-size and color independent.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-fs-10",
        "text-fs-11",
        "text-fs-12",
        "text-fs-13",
        "text-fs-16",
        "text-fs-18",
        "text-fs-20",
        "text-fs-24",
        "text-fs-28",
        "text-fs-32",
      ],
    },
  },
});

/**
 * Merges class names using `clsx` and resolves Tailwind CSS conflicts
 * with `tailwind-merge`.
 *
 * @param inputs - Class values (strings, arrays, objects, etc.).
 * @returns A single merged class string.
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

/**
 * Strips characters that are invalid in file/provider names
 * (`\ / : * " < > | ?`).
 *
 * @param str - The raw provider name.
 * @returns The sanitized string.
 */
export const sanitizeProviderName = (str: string) => {
  return str.replace(/[\\/:*"<>|?]/g, "");
};

/**
 * Checks whether a file type bitmask represents a document.
 *
 * @param type - The numeric file type bitmask.
 * @returns `true` if the document bit (`0x40`) is set.
 */
export const isDocument = (type: number) => {
  return !!(type & 0x40);
};

/**
 * Checks whether a file type bitmask represents a presentation.
 *
 * @param type - The numeric file type bitmask.
 * @returns `true` if the presentation bit (`0x80`) is set.
 */
export const isPresentation = (type: number) => {
  return !!(type & 0x80);
};

/**
 * Checks whether a file type bitmask represents a spreadsheet.
 *
 * @param type - The numeric file type bitmask.
 * @returns `true` if the spreadsheet bit (`0x0100`) is set.
 */
export const isSpreadsheet = (type: number) => {
  return !!(type & 0x0100);
};

/**
 * Checks whether a file type represents a PDF file.
 *
 * @param type - The numeric file type.
 * @returns `true` if `type` is `0x0201` or `0x0209`.
 */
export const isPdf = (type: number) => {
  return type === 0x0201 || type === 0x0209;
};

/**
 * Checks whether a file type represents a DjVu file.
 *
 * @param type - The numeric file type.
 * @returns `true` if `type` is `0x0203`.
 */
export const isDjVu = (type: number) => {
  return type === 0x0203;
};

/**
 * Checks whether a file type represents an XPS file.
 *
 * @param type - The numeric file type.
 * @returns `true` if `type` is `0x0204`.
 */
export const isXps = (type: number) => {
  return type === 0x0204;
};

/**
 * Checks whether a file type represents a PDF form.
 *
 * @param type - The numeric file type.
 * @returns `true` if `type` is `0x0057`.
 */
export const isPdfForm = (type: number) => {
  return type === 0x0057;
};

/**
 * Checks whether a file type bitmask represents a Visio file.
 *
 * @param type - The numeric file type bitmask.
 * @returns `true` if the Visio bit (`0x4000`) is set.
 */
export const isVisio = (type: number) => {
  return !!(type & 0x4000);
};

export const getFileIconName = (type: number): string => {
  if (isPdfForm(type)) return "pdf-form";
  if (isPdf(type)) return "pdf";
  if (isDjVu(type)) return "djvu";
  if (isXps(type)) return "xps";
  if (isSpreadsheet(type)) return "spreadsheets";
  if (isDocument(type)) return "documents";
  if (isPresentation(type)) return "presentations";
  if (isVisio(type)) return "visio";
  return "unknown-format";
};
