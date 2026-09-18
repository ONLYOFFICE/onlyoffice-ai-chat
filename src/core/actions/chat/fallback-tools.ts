import type { ThreadMessageLike } from "@assistant-ui/react";
import type { TMCPItem } from "../../../shared/mcp-item";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { augmentToolsWithIntent } from "../../../shared/tool-intent";
import { providerFor } from "../provider";
import { resolveSystemPrompt } from "../system-prompt";
import type { ActionArgs } from "../types";
import { systemPrompt as defaultPrompt } from "./prompt";

const OPEN = "<TOOL_CALL>";
const CLOSE = "</TOOL_CALL>";

// Models fine-tuned on Hermes/Qwen-style protocols drift to `<tool_call>`
// no matter what the instruction says, so both tags match case-insensitively.
const OPEN_RE = /<tool_call>/i;
const CLOSE_RE = /<\/tool_call>/i;

// A markdown fence the model wrapped the block in — with or without a
// language tag — would otherwise leak into the text before the call.
const TRAILING_FENCE_RE = /\n?```[a-z]*[ \t]*\n?$/i;

type AssistantContentPart = {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  argsText?: string;
  args?: Record<string, unknown>;
  result?: unknown;
};

export const buildToolsBlock = (tools: TMCPItem[]): string => {
  const lines: string[] = [];
  lines.push(
    "You have access to the following tools. To call a tool, output EXACTLY one block:"
  );
  lines.push(`${OPEN}{"name":"<tool_name>","arguments":{...}}${CLOSE}`);
  lines.push("");
  lines.push("Rules:");
  lines.push(
    "- Before the block, write exactly one short sentence, in the same language as the conversation, describing what the tool call will do."
  );
  lines.push(
    "- Output the block at most ONCE per turn, with nothing after it."
  );
  lines.push("- If you don't need a tool, answer normally without the block.");
  lines.push(
    "- After the system replies with <TOOL_RESULT>, continue your reasoning."
  );
  lines.push("");
  lines.push("Tools:");
  for (const tool of tools) {
    lines.push("");
    lines.push(`  Name: ${tool.name}`);
    lines.push(`  Description: ${tool.description}`);
    lines.push(`  Input schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
  }
  return lines.join("\n");
};

const stringifyToolCall = (toolName: string, argsObj: unknown): string => {
  const safeArgs = argsObj && typeof argsObj === "object" ? argsObj : {};
  return `${OPEN}${JSON.stringify({ name: toolName, arguments: safeArgs })}${CLOSE}`;
};

const stringifyResult = (result: unknown): string => {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
};

/**
 * Rewrite structured tool-call parts in assistant history into the text
 * protocol. Every resolved call closes the assistant turn: the call text
 * ends that message, its result follows as a user `<TOOL_RESULT>` message,
 * and any later parts open a fresh assistant message — so the model reads
 * call → result → follow-up in the order they actually happened, even
 * though `mergeResume` stores the follow-up in the same message.
 */
export const transformHistoryToText = (
  messages: ThreadMessageLike[]
): ThreadMessageLike[] => {
  const out: ThreadMessageLike[] = [];

  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      out.push(message);
      continue;
    }

    let textPieces: string[] = [];
    let pushed = false;
    const flushAssistant = () => {
      if (textPieces.length === 0) return;
      out.push({ ...message, content: textPieces.join("\n") });
      textPieces = [];
      pushed = true;
    };

    for (const rawPart of message.content) {
      const part = rawPart as AssistantContentPart;
      if (part.type === "text" && typeof part.text === "string") {
        textPieces.push(part.text);
      } else if (part.type === "tool-call" && part.toolName) {
        const argsObj =
          part.args && typeof part.args === "object" && part.args !== null
            ? part.args
            : safeParse(part.argsText);
        textPieces.push(stringifyToolCall(part.toolName, argsObj));
        if (part.result !== undefined && part.result !== null) {
          flushAssistant();
          out.push({
            role: "user",
            content: `<TOOL_RESULT>${stringifyResult(part.result)}</TOOL_RESULT>`,
          });
        }
      }
      // reasoning parts intentionally dropped
    }

    flushAssistant();
    if (!pushed) out.push({ ...message, content: "" });
  }

  return out;
};

const safeParse = (text: string | undefined): Record<string, unknown> => {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const extractText = (message: ThreadMessageLike): string => {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  let acc = "";
  for (const rawPart of message.content) {
    const part = rawPart as AssistantContentPart;
    if (part.type === "text" && typeof part.text === "string") {
      acc += part.text;
    }
  }
  return acc;
};

// Everything the protocol does not own (reasoning, images, …) is carried
// over verbatim so the text-protocol path renders the same as native.
const passthroughParts = (
  message: ThreadMessageLike
): AssistantContentPart[] => {
  if (!Array.isArray(message.content)) return [];
  return (message.content as AssistantContentPart[]).filter(
    (part) => part.type !== "text" && part.type !== "tool-call"
  );
};

const rebuild = (
  source: ThreadMessageLike,
  parts: AssistantContentPart[],
  isEnd: boolean
): SendMessageResult => {
  const message = {
    ...source,
    role: "assistant",
    content: [...passthroughParts(source), ...parts],
  } as unknown as ThreadMessageLike;
  return isEnd ? { isEnd: true, responseMessage: message } : message;
};

const textOnlyResult = (
  source: ThreadMessageLike,
  text: string,
  isEnd: boolean
): SendMessageResult => rebuild(source, [{ type: "text", text }], isEnd);

const toolCallResult = (
  source: ThreadMessageLike,
  textBefore: string,
  toolName: string,
  argsObj: Record<string, unknown>,
  toolCallId: string,
  isEnd: boolean
): SendMessageResult => {
  const parts: AssistantContentPart[] = [];
  if (textBefore.length > 0) {
    parts.push({ type: "text", text: textBefore });
  }
  parts.push({
    type: "tool-call",
    toolName,
    toolCallId,
    argsText: JSON.stringify(argsObj),
    args: argsObj,
  });
  return rebuild(source, parts, isEnd);
};

const indexOfTag = (text: string, tag: RegExp, from = 0): number => {
  const match = tag.exec(text.slice(from));
  return match ? from + match.index : -1;
};

const stripFence = (textBefore: string): string =>
  textBefore.replace(TRAILING_FENCE_RE, "");

export const wrapStream = async function* (
  upstream: AsyncGenerator<SendMessageResult>
): AsyncGenerator<SendMessageResult> {
  const holdTail = OPEN.length - 1;
  const toolCallId = crypto.randomUUID();

  let state: "scanning" | "buffering" | "emitted" | "broken" = "scanning";
  let frozenTextBefore = "";
  let frozenToolName = "";
  let frozenArgs: Record<string, unknown> = {};

  for await (const result of upstream) {
    const isEnd = "isEnd" in result;
    const message = isEnd ? result.responseMessage : result;

    // Terminal error / cancellation from the provider carries its state on
    // `status` and an empty body. Re-wrapping it as plain text would strip
    // the status and the chat would render it as a successful turn — forward
    // it untouched so `message-incomplete` (and the UI error) still fires.
    if (isEnd && message.status?.type === "incomplete") {
      yield result;
      return;
    }

    const rawText = extractText(message);

    if (state === "scanning") {
      const idx = indexOfTag(rawText, OPEN_RE);
      if (idx < 0) {
        const exposed = isEnd
          ? rawText
          : rawText.slice(0, Math.max(0, rawText.length - holdTail));
        yield textOnlyResult(message, exposed, isEnd);
        continue;
      }
      state = "buffering";
      // fall through into buffering branch
    }

    if (state === "buffering") {
      const idx = indexOfTag(rawText, OPEN_RE);
      const closeAt =
        idx >= 0 ? indexOfTag(rawText, CLOSE_RE, idx + OPEN.length) : -1;
      const textBefore = stripFence(idx >= 0 ? rawText.slice(0, idx) : rawText);

      if (idx < 0) {
        // shouldn't really happen — buffering means we already saw OPEN
        if (isEnd) {
          state = "broken";
          yield textOnlyResult(message, rawText, true);
        } else {
          yield textOnlyResult(message, textBefore, false);
        }
        continue;
      }

      if (closeAt < 0) {
        if (isEnd) {
          state = "broken";
          yield textOnlyResult(message, rawText, true);
        } else {
          yield textOnlyResult(message, textBefore, false);
        }
        continue;
      }

      const body = rawText.slice(idx + OPEN.length, closeAt);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        state = "broken";
        yield textOnlyResult(message, rawText, isEnd);
        continue;
      }

      const obj =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;
      const name = obj && typeof obj.name === "string" ? obj.name : "";
      const argsRaw = obj ? obj.arguments : undefined;
      const argsObj =
        argsRaw && typeof argsRaw === "object" && argsRaw !== null
          ? (argsRaw as Record<string, unknown>)
          : {};

      if (!name) {
        state = "broken";
        yield textOnlyResult(message, rawText, isEnd);
        continue;
      }

      state = "emitted";
      frozenTextBefore = textBefore;
      frozenToolName = name;
      frozenArgs = argsObj;
      yield toolCallResult(
        message,
        textBefore,
        name,
        argsObj,
        toolCallId,
        isEnd
      );
      continue;
    }

    if (state === "emitted") {
      // tool-call already exposed; ignore trailing text after </TOOL_CALL>.
      if (isEnd) {
        yield toolCallResult(
          message,
          frozenTextBefore,
          frozenToolName,
          frozenArgs,
          toolCallId,
          true
        );
      }
      continue;
    }

    // state === "broken"
    yield textOnlyResult(message, rawText, isEnd);
  }
};

/**
 * Run a streaming action with the text-protocol fallback: inject the
 * tools-instructions block into the supplied `baseSystemPrompt`, replace
 * tool-call/tool-result parts in history with text representations, send
 * to the provider WITHOUT the `tools` field, and parse `<TOOL_CALL>`
 * blocks out of the stream into synthetic tool-call content parts.
 */
export async function* streamWithTextProtocol(
  args: ActionArgs,
  baseSystemPrompt: string
): AsyncGenerator<SendMessageResult> {
  const tools = augmentToolsWithIntent(args.tools ?? []);
  const composedSystem = `${baseSystemPrompt}\n\n${buildToolsBlock(tools)}`;

  const provider = await providerFor(args);
  const upstream = provider.sendMessage({
    messages: transformHistoryToText(args.messages),
    model: args.profile.modelId,
    systemPrompt: composedSystem,
    withReasoning: args.isReasoning,
    reasoningLevel: args.reasoningLevel,
    useResponsesApi: args.profile.useResponsesApi === true,
    signal: args.signal,
  });

  yield* wrapStream(upstream);
}

export const chatViaTextProtocol = (
  args: ActionArgs
): AsyncGenerator<SendMessageResult> =>
  streamWithTextProtocol(args, resolveSystemPrompt(defaultPrompt, args.prompt));

/**
 * Predicate used by every action to decide whether the profile is
 * configured to use the text-protocol fallback for tool calls.
 */
export const isFallbackProfile = (profile: ActionArgs["profile"]): boolean =>
  profile.canUseTool === false;
