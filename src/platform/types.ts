import type { TCloud, TCloudKey, TMCPItem, TProcess } from "../types";

/**
 * File-system operations delegated to the host application.
 *
 * Covers picking files/images, converting document formats, and opening or
 * saving files through the host editor. If the host does not support file
 * operations, pass `null` for `PlatformAdapter.file` — the library will
 * hide all file-related UI automatically.
 */
export interface PlatformFileOperations {
  /** Show a native file picker dialog and return selected file paths, or null if cancelled */
  pickFiles(): Promise<{ path: string; name: string }[] | null>;

  /** Show a native image picker dialog and return the image as base64, or null if cancelled */
  pickImage(): Promise<{ name: string; base64: string } | null>;

  /** Convert a file at the given path to plain text (e.g. DOCX/PDF → text). Returns content and ONLYOFFICE file type code */
  convertFileToText(path: string, format: number): Promise<string>;

  /** Determine the ONLYOFFICE file type code for a file at the given path */
  getFileType(path: string): number;

  /** Get a JSON string of recently opened files from the host editor */
  getRecentFiles(): Promise<string>;

  /** Show a "Save As" dialog and save content as a file (e.g. export message as DOCX) */
  saveAsFile(content: string, defaultName: string): Promise<void>;

  /** Open a file in the host editor by path */
  openFile(path: string, name: string): void;
}

/**
 * External process runner used by the MCP STDIO server transport.
 *
 * When MCP servers are configured with a `command` (rather than an HTTP URL),
 * the library calls `createProcess` to spawn a child process and communicates
 * over its stdin/stdout using JSON-RPC 2.0. If the host environment cannot
 * spawn processes (e.g. a web browser), pass `null` for
 * `PlatformAdapter.process` — only HTTP-based MCP servers will be available.
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

  /** Subscribe to theme/language changes from the host. Returns an unsubscribe function */
  onEnvironmentChange?: (
    callback: (info: { theme?: string; lang?: string }) => void
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
 *   file: null,
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
  /** File operations: picking, converting, saving, opening files via the host. If null — file attachment buttons and "Save as DOCX" are hidden */
  file: PlatformFileOperations | null;

  /** External process runner for MCP STDIO server transport. If null — only HTTP MCP servers are available */
  process: PlatformProcessRunner | null;

  /** Host environment info: theme, locale, pixel ratio, change events */
  env: PlatformEnvironment;

  /** Built-in tools exposed by the host application. If null — no host tools section in the tools list */
  hostTools: PlatformHostTools | null;

  /** Optional fetch wrapper for proxied HTTP requests (e.g. CORS proxy). If null — standard fetch is used */
  fetchProxy?: (url: string, init?: RequestInit) => Promise<Response>;

  /** Cloud accounts connected in the host application. If null — cloud provider features are unavailable */
  clouds: PlatformClouds | null;
}
