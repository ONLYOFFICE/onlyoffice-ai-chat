/**
 * The set of file formats the widget can turn into a text attachment, and the
 * filter descriptor it hands to a host file picker.
 *
 * This is the single source of truth for "what can be attached from disk". It
 * is consumed three times:
 *
 * - {@link ATTACHMENT_PICK_FILTERS} is passed to
 *   `PlatformFileOperations.pickFiles` so the host's native dialog offers only
 *   these groups — no `All files (*.*)` escape hatch.
 * - {@link ATTACHMENT_ACCEPT} is the same set as an `accept` attribute, for a
 *   web host that opens its own `<input type="file">` instead of going through
 *   `pickFiles` — the browser's own file dialog then greys out the rest.
 * - {@link isSupportedAttachmentPath} re-checks whatever the host returns,
 *   because the filter is a hint the host may ignore (older builds take no
 *   argument at all) and the user can always type a name by hand.
 *
 * Every extension here must survive `convertFileToText`. Formats the editor can
 * open but cannot flatten to text (media, archives) are deliberately absent.
 */

/** A named group of extensions, mapped by the host onto one native filter row. */
export interface AttachmentPickFilter {
  /**
   * Stable, untranslated identifier for the group. Hosts that localize their
   * own dialog chrome key off this rather than off `label`.
   */
  id: string;
  /** English fallback label, used by hosts with no localization of their own. */
  label: string;
  /** Extensions in the group, lowercase and without a leading dot. */
  extensions: string[];
}

const DOCUMENT_EXTENSIONS = [
  "doc",
  "docm",
  "docx",
  "docxf",
  "dot",
  "dotm",
  "dotx",
  "epub",
  "fb2",
  "fodt",
  "htm",
  "html",
  "mht",
  "mhtml",
  "odt",
  "ott",
  "oform",
  "rtf",
  "stw",
  "sxw",
  "wps",
  "wpt",
  "xml",
];

const SPREADSHEET_EXTENSIONS = [
  "csv",
  "et",
  "ett",
  "fods",
  "ods",
  "ots",
  "sxc",
  "tsv",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
];

const PRESENTATION_EXTENSIONS = [
  "dps",
  "dpt",
  "fodp",
  "odp",
  "otp",
  "pot",
  "potm",
  "potx",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "sxi",
];

const PDF_EXTENSIONS = ["djvu", "oxps", "pdf", "xps"];

const TEXT_EXTENSIONS = ["md", "markdown", "txt"];

/**
 * Filter groups offered in the host's file dialog, in display order.
 *
 * The host is expected to render one row per entry. It must not append an
 * "all files" row — the widget rejects anything outside these groups anyway,
 * so such a row can only produce a pick that silently fails.
 */
export const ATTACHMENT_PICK_FILTERS: readonly AttachmentPickFilter[] = [
  {
    id: "documents",
    label: "Text documents",
    extensions: DOCUMENT_EXTENSIONS,
  },
  {
    id: "spreadsheets",
    label: "Spreadsheets",
    extensions: SPREADSHEET_EXTENSIONS,
  },
  {
    id: "presentations",
    label: "Presentations",
    extensions: PRESENTATION_EXTENSIONS,
  },
  { id: "pdf", label: "Crossplatform", extensions: PDF_EXTENSIONS },
  { id: "text", label: "Text files", extensions: TEXT_EXTENSIONS },
];

/** Flat lookup of every attachable extension, built from the filter groups. */
const SUPPORTED_EXTENSIONS = new Set(
  ATTACHMENT_PICK_FILTERS.flatMap((filter) => filter.extensions)
);

/**
 * {@link ATTACHMENT_PICK_FILTERS} as an `accept` attribute value — a
 * comma-separated list of dotted extensions, in the same order.
 *
 * For a web host that opens its own `<input type="file">` (a `composerActions`
 * entry, a portal upload dialog) rather than the widget's `pickFiles` path:
 * setting this as `accept` makes the browser's file dialog grey out everything
 * the widget cannot convert, instead of letting the user pick an archive and
 * hit an error afterwards.
 *
 * Extensions only, no MIME types: the set is keyed by extension throughout
 * (see {@link isSupportedAttachmentPath}), and several entries here — `oform`,
 * `docxf`, `fb2` — have no MIME type a browser would recognize.
 *
 * Images are **not** included; they ride the separate `accept="image/*"` input.
 */
export const ATTACHMENT_ACCEPT: string = ATTACHMENT_PICK_FILTERS.flatMap(
  (filter) => filter.extensions
)
  .map((ext) => `.${ext}`)
  .join(",");

/**
 * Extracts the lowercase extension of a path, handling both separators.
 *
 * Returns `""` for a path with no extension, or one whose only dot is part of
 * a directory name (`/a.b/file`) or a leading dot (`.gitignore`) — none of
 * which name an attachable document.
 */
const getExtension = (path: string): string => {
  const name = path.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase();
};

const IMAGE_EXTENSIONS = [
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
];

/**
 * The one filter row for "Add local image" when images are attached by path
 * (`WidgetConfig.attachFilesByPath`): the host's native dialog is opened with
 * this instead of the internal `<input accept="image/*">`. Kept apart from
 * {@link ATTACHMENT_PICK_FILTERS}, whose every entry must survive
 * `convertFileToText`; an image never does, it is read by a host tool.
 */
export const IMAGE_PICK_FILTER: AttachmentPickFilter = {
  id: "images",
  label: "Images",
  extensions: IMAGE_EXTENSIONS,
};

const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);

/**
 * Whether a path picked from disk is one the widget can attach.
 *
 * Applied to every entry a host picker returns. A host that honours
 * {@link ATTACHMENT_PICK_FILTERS} never trips this; one that ignores the
 * argument, or lets the user type an arbitrary name, does.
 *
 * @param path - Absolute or relative path, with either separator.
 * @returns `true` if the extension is in {@link ATTACHMENT_PICK_FILTERS}.
 */
export const isSupportedAttachmentPath = (path: string): boolean => {
  return SUPPORTED_EXTENSIONS.has(getExtension(path));
};

/**
 * Whether a path picked from disk names an image the widget can attach by
 * path — the same re-check as {@link isSupportedAttachmentPath}, against
 * {@link IMAGE_PICK_FILTER}.
 */
export const isSupportedImagePath = (path: string): boolean => {
  return IMAGE_EXTENSION_SET.has(getExtension(path));
};
