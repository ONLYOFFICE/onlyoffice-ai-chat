import type { AttachmentPickFilter } from "../../../shared/attachment-formats";
import type { TCloud, TCloudKey, TMCPItem, TProcess } from "../../../types";

/**
 * Content format of the text passed to {@link PlatformAdapter.copyToClipboard}.
 *
 * - `"markdown"` — a message body (assistant reply or user prompt); the
 *   string is Markdown source.
 * - `"text"` — raw, verbatim content: a code block's source or a tool call's
 *   arguments / result (JSON).
 */
export type CopyFormat = "markdown" | "text";

/**
 * A chat-export format offered by the host application.
 *
 * Returned from {@link PlatformFileOperations.getExportFormats}. When the host
 * declares more than one format, the chat menu replaces the single "Save" item
 * with an "Export" submenu listing every format; the chosen format's
 * {@link ExportFormat.id} is passed back to
 * {@link PlatformFileOperations.saveAsFile} as its third argument.
 */
export interface ExportFormat {
  /** Stable identifier passed back to `saveAsFile`, e.g. `"docx"`, `"pdf"`, `"md"`. */
  id: string;
  /** Human-readable label shown in the export submenu, e.g. `"Word (.docx)"`. */
  label: string;
  /** File extension used for the default file name (without a leading dot), e.g. `"docx"`. */
  extension: string;
}

/**
 * Metadata describing what is being copied, passed as the second argument to
 * {@link PlatformAdapter.copyToClipboard}.
 */
export interface CopyMeta {
  /** Content format of the copied `text`. See {@link CopyFormat}. */
  format: CopyFormat;
}

/**
 * Extra parts of a toast, passed as the second argument to
 * {@link PlatformAdapter.showToast}.
 */
export interface ToastMeta {
  /**
   * Bold line shown above `text`, e.g. "API key saved." over "Web search is
   * available in AI Chat.". Maps onto the title of the host's own toast.
   */
  heading?: string;
}

/**
 * File-system operations delegated to the host application.
 *
 * Covers picking files/images, converting document formats, and opening or
 * saving files through the host editor. If the host does not support file
 * operations, pass `null` for `PlatformAdapter.file` — the library will
 * hide all file-related UI automatically.
 *
 * Every method is optional and gated independently: the library shows each
 * UI element only when its specific capability is present. A host can, for
 * example, expose `saveAsFile` (chat export) while omitting `pickFiles`,
 * `getRecentFiles`, and `openFile` to hide the local-file / recent-files
 * pickers without losing save/export.
 */
export interface PlatformFileOperations {
  /**
   * Show a native file picker dialog and return selected file paths, or null
   * if cancelled.
   *
   * `filters` lists the format groups the widget can actually attach, in the
   * order they should appear in the dialog. A host that can configure its
   * dialog should render exactly one row per entry and **must not** add an
   * "all files" row: the widget re-checks every returned path against the
   * same list and silently drops anything outside it, so a file picked
   * through such a row would attach nothing.
   *
   * The argument is additive — hosts predating it keep working, and the
   * widget's own check is what actually enforces the format set.
   */
  pickFiles?(
    filters?: readonly AttachmentPickFilter[]
  ): Promise<{ path: string; name: string }[] | null>;

  /** Show a native image picker dialog and return the image as base64, or null if cancelled */
  pickImage?(): Promise<{ name: string; base64: string } | null>;

  /**
   * Convert a file at the given path to plain text (e.g. DOCX/PDF → text).
   * Not called when `WidgetConfig.attachFilesByPath` is on.
   */
  convertFileToText?(path: string, format: number): Promise<string>;

  /** Determine the ONLYOFFICE file type code for a file at the given path */
  getFileType?(path: string): number;

  /** Get a JSON string of recently opened files from the host editor */
  getRecentFiles?(): Promise<string>;

  /**
   * Subscribe to recent-files list changes. Returns an unsubscribe function.
   *
   * The callback carries no payload: {@link getRecentFiles} stays the only
   * source of the list, and the library re-reads it on every signal. Hosts
   * may fire the callback in bursts (e.g. once per checked file) — the
   * library keeps only the newest read.
   *
   * Omit it when the host cannot observe the list. The library then reads
   * once on mount, which is enough for a host that reloads the page along
   * with the document, but leaves the submenu frozen in a long-lived
   * embedding such as a desktop plugin panel.
   */
  onRecentFilesChange?(callback: () => void): () => void;

  /**
   * Show a "Save As" dialog and save content as a file (e.g. export message
   * as DOCX). The library always passes Markdown source as `content`; the
   * host is responsible for converting it to the target format.
   *
   * `format` is the {@link ExportFormat.id} chosen from the export submenu.
   * It is omitted for the default "Save" action (when the host declares no
   * formats via {@link getExportFormats}), in which case the host should fall
   * back to its default behavior — preserving backward compatibility with
   * hosts that ignore the third argument.
   */
  saveAsFile?(
    content: string,
    defaultName: string,
    format?: string
  ): Promise<void>;

  /**
   * Declare the chat-export formats offered in the chat menu. Return more than
   * one {@link ExportFormat} to replace the single "Save" item with an
   * "Export" submenu; the chosen format's `id` is forwarded to
   * {@link saveAsFile}. Omit (or return `[]` / a single entry) to keep the
   * default single "Save" action.
   */
  getExportFormats?(): ExportFormat[];

  /** Open a file in the host editor by path */
  openFile?(path: string, name: string): void;
}

/**
 * External process runner used by the MCP STDIO server transport.
 *
 * When MCP servers are configured with a `command` (rather than an HTTP URL),
 * the library calls `createProcess` to spawn a child process and communicates
 * over its stdin/stdout using JSON-RPC 2.0. If the host environment cannot
 * spawn processes (e.g. a web browser), pass `null` for
 * `PlatformAdapter.process` — only HTTP-based MCP servers will be available.
 *
 * Stdout chunks handed to `TProcess.onprocess` may hold several messages or
 * a fragment of one; the widget cuts them on `\n` itself. Server-initiated
 * messages (`notifications/tools/list_changed`, `ping`) arrive over the same
 * pipe and are handled by the widget, so the host must forward every stdout
 * chunk, not only replies to its own writes.
 */
export interface PlatformProcessRunner {
  /** Spawn an external process (used for MCP STDIO servers). Returns a process handle or null if unavailable */
  createProcess(command: string, env?: Record<string, string>): TProcess | null;

  /** Check whether external process spawning is supported in the current environment */
  isAvailable(): boolean;
}

/**
 * Host environment information: theme, locale, and display characteristics.
 *
 * The library reads these values at startup and, if `onEnvironmentChange` is
 * provided, subscribes to live updates so the UI stays in sync with the host
 * application.
 */
export interface PlatformEnvironment {
  /** Current UI theme set by the host application */
  theme: string;

  /** OS-level system theme (may differ from the app theme) */
  systemTheme: "dark" | "light";

  /** Current locale/language code (e.g. "en", "ru", "de") */
  locale: string;

  /** Device pixel ratio for high-DPI rendering */
  devicePixelRatio: number;

  /**
   * Subscribe to environment changes from the host. Returns an unsubscribe
   * function. The host invokes the callback with only the fields that changed:
   * `theme`/`lang` for theme or locale switches, and `devicePixelRatio` when
   * the display density changes (e.g. the window moves to a monitor with a
   * different DPR, or the user zooms). All fields are optional and additive —
   * a host that never reports `devicePixelRatio` keeps the startup scale.
   */
  onEnvironmentChange?: (
    callback: (info: {
      theme?: string;
      lang?: string;
      devicePixelRatio?: number;
    }) => void
  ) => () => void;
}

/**
 * Cloud account integration provided by the host application.
 *
 * Allows the library to list cloud-connected AI providers (e.g. a
 * corporate OpenAI deployment) and react when the set of accounts changes.
 */
export interface PlatformClouds {
  /** Get the list of connected cloud accounts from the host application */
  getClouds(): Promise<TCloud[]>;

  /** Get the list of cloud keys */
  getCloudKeys(): TCloudKey[];

  /** Subscribe to cloud account list changes. Returns an unsubscribe function */
  onCloudsChange?(callback: () => void): () => void;
}

/**
 * Built-in tools exposed by the host application (e.g. ONLYOFFICE editor
 * commands such as "insert table" or "apply style").
 *
 * These tools appear alongside MCP and web-search tools in the unified tool
 * list. If the host has no built-in tools, pass `null` for
 * `PlatformAdapter.hostTools`.
 */
export interface PlatformHostTools {
  /** Get the list of built-in tools provided by the host application (e.g. ONLYOFFICE editor tools) */
  getTools(): TMCPItem[];

  /** Execute a built-in host tool by name with the given arguments. Returns a JSON string result */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

/**
 * Top-level platform adapter that bundles every host-specific capability.
 *
 * Each sub-adapter is nullable: set it to `null` when the host does not
 * support that capability, and the library will gracefully hide the
 * corresponding UI and skip the related logic.
 *
 * @example
 * ```ts
 * import type { PlatformAdapter } from "@onlyoffice/ai-chat";
 *
 * // Minimal browser-only implementation — no native file ops, no process
 * // spawning, no host tools, no clouds.
 * const minimalPlatform: PlatformAdapter = {
 *   process: null,
 *   env: {
 *     theme: "light",
 *     systemTheme: "light",
 *     locale: "en",
 *     devicePixelRatio: window.devicePixelRatio,
 *   },
 *   hostTools: null,
 *   clouds: null,
 * };
 * ```
 */
export interface PlatformAdapter {
  /** File operations: picking, converting, saving, opening files via the host. Omit (or provide only a subset) when the host implements none/part of these — unavailable operations hide the file attachment buttons and "Save as DOCX" */
  file?: Partial<PlatformFileOperations>;

  /** External process runner for MCP STDIO server transport. If null — only HTTP MCP servers are available */
  process: PlatformProcessRunner | null;

  /**
   * True when the host backend registers and executes the user's custom MCP
   * servers itself (their tools then arrive through
   * `api.tools.listSystemTools`, alongside the host's system servers). The
   * widget neither starts nor lists those servers locally: without this
   * flag each registered server would connect twice (browser + backend) and
   * render two permission cards, with the browser attempt typically dying
   * on CORS. Leave unset for hosts where the widget itself runs the
   * configured servers (desktop, standalone browser embeds).
   */
  customServersExecutedByHost?: boolean;

  /** Host environment info: theme, locale, pixel ratio, change events */
  env: PlatformEnvironment;

  /** Built-in tools exposed by the host application. If null — no host tools section in the tools list */
  hostTools: PlatformHostTools | null;

  /** Optional fetch wrapper for proxied HTTP requests (e.g. CORS proxy). If null — standard fetch is used */
  fetchProxy?: (url: string, init?: RequestInit) => Promise<Response>;

  /**
   * Transport hook used exclusively by the `"external"` built-in
   * provider. The external provider has no SDK and no built-in
   * transport of its own — every HTTP request it makes (chat
   * completions, model listing, connection probes, image generation)
   * is delegated to this function. The host is responsible for
   * authentication, routing, and the actual network call; the library
   * only takes care of parsing the response in the format chosen by
   * `Profile.basedOn` (`"openai"`, `"anthropic"`, `"mistral"`,
   * `"openrouter"`).
   *
   * Required when any `Profile` has `providerType: "external"` —
   * absence raises a clear error at request time and is independent of
   * the {@link Profile.useProxy} flag (which governs the unrelated
   * `fetchProxy` hook above).
   */
  externalFetch?: (url: string, init?: RequestInit) => Promise<Response>;

  /**
   * Optional host-supplied clipboard writer. When set, all in-chat copy
   * actions (message "Copy", code block "Copy") delegate to it instead
   * of calling `navigator.clipboard.writeText` directly — required in
   * environments where the Clipboard API is unavailable (cross-origin
   * iframe without `clipboard-write` permission, native WebView host,
   * etc.). May return a `Promise` or be synchronous.
   *
   * The optional second argument {@link CopyMeta} describes what is being
   * copied — `format: "markdown"` for message bodies (assistant / user) and
   * `format: "text"` for raw content (code blocks, tool args/results). It is
   * additive and backward compatible; it can be ignored if not needed.
   */
  copyToClipboard?: (text: string, meta?: CopyMeta) => void | Promise<void>;

  /**
   * Optional host-supplied notification. When set, the chat's own toasts
   * (e.g. "Prompt saved") are handed to it instead of being rendered by the
   * built-in stack — so a host with its own notification system (DocSpace's
   * `toastr`) keeps one consistent look and, crucially, its own positioning:
   * the built-in viewport sits above the chat composer, which is wrong for a
   * host that anchors notifications to the whole page.
   *
   * Severity is left out on purpose: every toast the chat raises today is a
   * success confirmation. Add a second argument when that stops being true
   * rather than having hosts guess.
   *
   * The optional second argument {@link ToastMeta} carries a heading for
   * two-line toasts ("API key saved." over its explanation). It is additive:
   * a host that ignores it still shows `text`.
   */
  showToast?: (text: string, meta?: ToastMeta) => void;

  /** Cloud accounts connected in the host application. If null — cloud provider features are unavailable */
  clouds: PlatformClouds | null;
}
