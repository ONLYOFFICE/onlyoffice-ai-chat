import type { ThreadMessageLike } from "@assistant-ui/react";
import { stripToolIntent } from "./shared/tool-intent";

/**
 * Module-global "export everything" switch. Off by default: the normal
 * export is the reader-facing transcript (user questions + assistant
 * answers). When a host runs the editor in debug mode it flips this on via
 * `WidgetConfig.debugExport` and every export path then dumps the full
 * message model — tool calls with their arguments and results, reasoning
 * blocks, attachments — with nothing cut out.
 *
 * A module global (same pattern as `shared/logger`'s threshold) rather than
 * a parameter threaded through every caller: the conversion utilities are
 * pure, framework-free, and exported publicly, so they must stay readable
 * from code that has no access to React context.
 */
let verboseExport = false;

/**
 * Enable/disable full ("nothing cut out") export output globally.
 *
 * @param value - `true` to include tool calls, results and reasoning.
 */
export const setVerboseExport = (value: boolean) => {
  verboseExport = value;
};

/**
 * Whether the desktop editor is running in debug mode.
 *
 * The editor appends a `DebugMode` token to its User-Agent right after the
 * `AscDesktopEditor/<version>` product token:
 *
 * ```
 * … Chrome/109.0.0.0 AscDesktopEditor/2.5.565.0 DebugMode Safari/537.36
 * ```
 *
 * Matched as a whole token so a future product string that merely contains
 * the word (`AscDesktopEditorDebugModeless/…`) doesn't trip it. The check is
 * deliberately not anchored to `AscDesktopEditor` itself — a debug build of
 * the web editor would carry the token without the desktop product string.
 *
 * Kept a function rather than a module constant so it is evaluated per call:
 * the widget can be imported before the host has finished setting up its
 * environment, and a constant would freeze whatever was true at import time.
 *
 * `navigator` is guarded because these utilities are framework-free and run
 * in Node during tests and SSR.
 */
const isDebugEditor = (): boolean => {
  const ua = globalThis.navigator?.userAgent;
  return typeof ua === "string" && /(?:^|\s)DebugMode(?:\s|$)/.test(ua);
};

/**
 * Current state of the global verbose-export switch: either the host set it
 * explicitly via {@link setVerboseExport}, or the editor is running in debug
 * mode (see {@link isDebugEditor}).
 */
export const getVerboseExport = () => verboseExport || isDebugEditor();

/** Per-call override for the export serializers. */
export interface ExportOptions {
  /**
   * Include every content part — tool calls (name, arguments, result),
   * reasoning blocks and attachment markers — instead of only the
   * user/assistant prose. Defaults to {@link getVerboseExport}.
   */
  verbose?: boolean;
}

/** Pretty-prints a tool argument/result payload for a fenced code block. */
const formatPayload = (value: unknown): string => {
  if (value === undefined) return "";
  if (typeof value === "string") {
    // Tool results arrive as a JSON string from most providers; re-indent it
    // when it parses, otherwise keep the raw text.
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * Renders a non-text content part as a Markdown block for verbose export.
 * Returns `""` for parts that carry nothing worth writing down.
 */
const formatVerbosePart = (part: Record<string, unknown>): string => {
  const type = part.type;

  if (type === "reasoning") {
    const text = typeof part.text === "string" ? part.text : "";
    return text.trim() ? `**Reasoning:**\n\n${text}\n\n` : "";
  }

  if (type === "tool-call") {
    const name =
      typeof part.toolName === "string" ? part.toolName : "unknown tool";

    // The synthetic `aiChatIntent` argument is the model's own one-line
    // description of the call — promote it to a caption and strip it from
    // the argument dump, the same treatment the tool card gives it.
    const rawArgs =
      part.args && typeof part.args === "object"
        ? (part.args as Record<string, unknown>)
        : undefined;
    const intent =
      rawArgs && typeof rawArgs.aiChatIntent === "string"
        ? rawArgs.aiChatIntent
        : undefined;
    const args = rawArgs
      ? stripToolIntent(rawArgs)
      : typeof part.argsText === "string"
        ? part.argsText
        : undefined;

    let block = `**Tool call:** \`${name}\`\n\n`;
    if (intent) block += `${intent}\n\n`;

    const argsText = formatPayload(args);
    block += `Arguments:\n\n\`\`\`json\n${argsText || "{}"}\n\`\`\`\n\n`;

    if (part.result !== undefined) {
      block += `Result:\n\n\`\`\`json\n${formatPayload(part.result)}\n\`\`\`\n\n`;
    } else {
      block += `Result: _(none)_\n\n`;
    }

    return block;
  }

  if (type === "image" || type === "file" || type === "source") {
    return `**Attachment (${String(type)}):**\n\n\`\`\`json\n${formatPayload(part)}\n\`\`\`\n\n`;
  }

  // Unknown future part kind — in verbose mode nothing is cut out, so dump it.
  return `**${String(type ?? "unknown")}:**\n\n\`\`\`json\n${formatPayload(part)}\n\`\`\`\n\n`;
};

/**
 * Converts an array of thread messages into a Markdown string.
 * User messages are formatted as `##` headings; assistant messages as
 * plain paragraphs. Tool-call parts are skipped.
 *
 * In verbose mode (debug export — see {@link setVerboseExport}) nothing is
 * skipped: tool calls are written out with their arguments and results, and
 * reasoning blocks and attachments are included too.
 *
 * @param messages - The messages to convert.
 * @param options - Per-call overrides; defaults to the global switch.
 * @returns A Markdown-formatted string.
 */
export const convertMessagesToMd = (
  messages: ThreadMessageLike[],
  options?: ExportOptions
) => {
  const verbose = options?.verbose ?? getVerboseExport();
  let content = "";

  messages.forEach((message) => {
    if (Array.isArray(message.content)) {
      message.content.forEach((part: ThreadMessageLike["content"]) => {
        if (typeof part === "string") {
          content += message.role === "user" ? `## ${part}\n\n` : `${part}\n\n`;
          return;
        }

        if (!part || typeof part !== "object" || !("type" in part)) return;

        if (part.type === "text" && "text" in part) {
          content +=
            message.role === "user"
              ? `## ${part.text}\n\n`
              : `${part.text}\n\n`;
        } else if (verbose) {
          content += formatVerbosePart(
            part as unknown as Record<string, unknown>
          );
        }
      });
    } else if (typeof message.content === "string") {
      content +=
        message.role === "user"
          ? `## ${message.content}\n\n`
          : `${message.content}\n\n`;
    }
  });

  return content;
};

/**
 * Extracts the plain-text content of a single message — joins all `text`
 * parts of `message.content` (plus bare-string parts) with newlines and
 * skips tool-call parts. No role prefix, no Markdown headings.
 *
 * In verbose mode (debug export — see {@link setVerboseExport}) tool calls,
 * reasoning and attachments are included as well.
 *
 * @param message - The message to extract text from.
 * @param options - Per-call overrides; defaults to the global switch.
 * @returns The plain text content of the message.
 */
export const getMessageText = (
  message: ThreadMessageLike,
  options?: ExportOptions
): string => {
  if (typeof message.content === "string") return message.content;

  if (!Array.isArray(message.content)) return "";

  const verbose = options?.verbose ?? getVerboseExport();

  const parts: string[] = [];
  message.content.forEach((part: ThreadMessageLike["content"]) => {
    if (typeof part === "string") {
      parts.push(part);
      return;
    }
    if (!part || typeof part !== "object" || !("type" in part)) return;
    if (
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      parts.push(part.text);
      return;
    }
    if (verbose) {
      const block = formatVerbosePart(
        part as unknown as Record<string, unknown>
      ).trimEnd();
      if (block) parts.push(block);
    }
  });

  return parts.join("\n\n");
};

/**
 * Strips characters that are invalid in file names (`\ / : * " < > | ?`).
 *
 * @param str - The input string.
 * @returns The sanitized string.
 */
export const removeSpecialCharacter = (str: string) => {
  return str.replace(/[\\/:*"<>|?]/g, "");
};

/**
 * Extracts a short title (up to 30 characters) from the first line of a
 * Markdown string, stripping the `## ` heading prefix and special characters.
 *
 * @param md - A Markdown string (typically from {@link convertMessagesToMd}).
 * @returns A sanitized title string.
 */
export const getMessageTitleFromMd = (md: string) => {
  const lines = md.split("\n");

  const title = lines[0].replace("## ", "");

  return removeSpecialCharacter(title).substring(0, 30);
};
