import type { ThreadMessageLike } from "@assistant-ui/react";

/**
 * Converts an array of thread messages into a Markdown string.
 * User messages are formatted as `##` headings; assistant messages as
 * plain paragraphs. Tool-call parts are skipped.
 *
 * @param messages - The messages to convert.
 * @returns A Markdown-formatted string.
 */
export const convertMessagesToMd = (messages: ThreadMessageLike[]) => {
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
        } else if (part.type === "tool-call" && "toolName" in part) {
          return;
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
 * @param message - The message to extract text from.
 * @returns The plain text content of the message.
 */
export const getMessageText = (message: ThreadMessageLike): string => {
  if (typeof message.content === "string") return message.content;

  if (!Array.isArray(message.content)) return "";

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
