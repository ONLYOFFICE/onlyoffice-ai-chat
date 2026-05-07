import logger from "../../../shared/logger";
import type { TMCPItem } from "../../../shared/mcp-item";
import type { SendMessageResult } from "../../../shared/send-message-args";
import type { Profile } from "../../types";
import { credsOf, providerFor } from "./lookup";

const PROBE_TIMEOUT_MS = 15_000;

const probeTool: TMCPItem = {
  name: "probe_echo",
  description:
    'Echo a string back. Call this tool with text="ok" to confirm tool support.',
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
};

const probeMessages = [
  {
    role: "user" as const,
    content:
      'Call the probe_echo tool with text="ok". Do not answer in plain text.',
  },
];

const hasProbeToolCall = (result: SendMessageResult): boolean => {
  const message = "isEnd" in result ? result.responseMessage : result;
  if (!Array.isArray(message.content)) return false;
  for (const part of message.content) {
    if (
      typeof part === "object" &&
      part !== null &&
      (part as { type?: unknown }).type === "tool-call" &&
      (part as { toolName?: unknown }).toolName === probeTool.name
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Live probe: ask the configured model to call a fake tool. Returns `true`
 * when the model emits a `tool-call` content part for `probe_echo`,
 * otherwise `false`. Never throws — network/timeout/provider errors all
 * collapse to `false`.
 */
export async function probeToolCapability(
  profile: Pick<Profile, "providerType" | "modelId" | "baseUrl" | "key">,
  externalSignal?: AbortSignal
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const Provider = providerFor(profile.providerType);
    const provider = new Provider(credsOf(profile));

    const stream = provider.sendMessage({
      messages: probeMessages,
      model: profile.modelId,
      systemPrompt: "",
      tools: [probeTool],
      signal: controller.signal,
    });

    for await (const result of stream) {
      if (hasProbeToolCall(result)) return true;
    }
    return false;
  } catch (error) {
    logger.warn("probeToolCapability failed:", error);
    return false;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
