import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Content, Part } from "@google/genai";
import { parseGuardedImageDataUrl } from "../../../shared/image-data-url";

/** Extract the filename from a Unix- or Windows-style path. */
const extractFilename = (path: string): string => {
  const separator = path.includes("\\") ? "\\" : "/";
  return path.split(separator).pop() ?? path;
};

/**
 * Translate a user-role message into GenAI `Part[]`.
 * Text passes through, images become `inlineData`, files are folded
 * into a text part prefixed with their filename.
 */
const convertUserContent = (message: ThreadMessageLike): Part[] => {
  if (typeof message.content === "string") {
    return [{ text: message.content }];
  }

  const parts: Part[] = [];
  for (const part of message.content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
      continue;
    }

    if (part.type === "image") {
      // Skip non-data values (leftover ref or http(s) URL) — GenAI needs
      // inline base64; `parseGuardedImageDataUrl` warns on a real miss.
      const parsed = parseGuardedImageDataUrl(part.image);
      if (parsed) {
        parts.push({
          inlineData: { mimeType: parsed.mimeType, data: parsed.base64 },
        });
      }
      continue;
    }

    if (part.type === "file") {
      const meta = JSON.parse(part.mimeType);
      const filename = extractFilename(meta.path);
      parts.push({ text: `File: ${filename}\nFile content:\n${part.data}` });
    }
  }
  return parts;
};

/**
 * Translate an assistant-role message into GenAI `Content[]`.
 *
 * GenAI requires `functionResponse`s to arrive as a separate `user`
 * content entry after the `model` content that triggered them, so a
 * single assistant `ThreadMessageLike` may expand into two entries.
 */
const convertAssistantMessage = (message: ThreadMessageLike): Content[] => {
  const results: Content[] = [];

  if (typeof message.content === "string") {
    if (message.content) {
      results.push({ role: "model", parts: [{ text: message.content }] });
    }
    return results;
  }

  const parts: Part[] = [];
  const functionResponses: Part[] = [];

  for (const part of message.content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
    } else if (part.type === "reasoning") {
      parts.push({ text: part.text, thought: true });
    } else if (part.type === "tool-call") {
      const metadata = (
        part as unknown as { metadata?: { thoughtSignature?: string } }
      ).metadata;
      const thoughtSignature = metadata?.thoughtSignature;

      parts.push({
        functionCall: {
          name: part.toolName,
          args: part.args as Record<string, unknown>,
        },
        ...(thoughtSignature && { thoughtSignature }),
      } as Part);

      if (part.result) {
        functionResponses.push({
          functionResponse: {
            name: part.toolName,
            response: { result: part.result },
          },
        });
      }
    }
  }

  if (parts.length) {
    results.push({ role: "model", parts });
  }

  if (functionResponses.length) {
    results.push({ role: "user", parts: functionResponses });
  }

  return results;
};

/**
 * Convert the thread into GenAI's `Content[]` format.
 *
 * GenAI has only two roles (`user`, `model`) — system messages are
 * merged into user (the system prompt itself goes through
 * `config.systemInstruction` instead of the content array).
 *
 * @param messages - Thread history + latest turn.
 * @returns A flat array ready for `models.generateContent{Stream}`.
 */
export const convertMessages = (messages: ThreadMessageLike[]): Content[] => {
  const result: Content[] = [];

  for (const message of messages) {
    if (message.role === "user" || message.role === "system") {
      result.push({ role: "user", parts: convertUserContent(message) });
    } else {
      result.push(...convertAssistantMessage(message));
    }
  }

  return result;
};
