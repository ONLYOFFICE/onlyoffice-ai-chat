import type OpenAI from "openai";
import type { ProviderCredentials } from "../../../shared/provider-credentials";

/**
 * Parameters for {@link openSSEStream}. Mirrors the shape consumed by
 * `OpenAIProvider.getStream` so ONLYOFFICE can drop this into the same
 * slot.
 */
export interface SSEStreamParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  model: string;
  tools: OpenAI.Chat.ChatCompletionTool[];
  withReasoning?: boolean;
  signal?: AbortSignal;
}

/**
 * Open an ONLYOFFICE SSE streaming request and return an async-iterable
 * that yields OpenAI-shaped `chat.completions` stream chunks.
 *
 * ONLYOFFICE's AI endpoint speaks the OpenAI chat API on the wire but
 * isn't reachable via the official SDK (custom URL suffix, non-standard
 * error shape in SSE events), so we drive it with raw `fetch` + manual
 * SSE parsing and adapt the result back into the SDK's iterable shape.
 *
 * @param creds  - Credentials (baseUrl already transformed to include
 *   the `/api/2.0/ai/openai/-1/v1` suffix by the ONLYOFFICE provider's
 *   constructor).
 * @param params - Streaming request parameters.
 * @returns An iterable compatible with `OpenAIProvider.getStream`.
 * @throws When the response is not SSE (falls back to parsing a JSON
 *   error payload) or when the SSE stream itself carries an `error` frame.
 */
export const openSSEStream = async (
  creds: ProviderCredentials,
  params: SSEStreamParams
) => {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: true,
  };

  if (params.tools.length > 0) body.tools = params.tools;
  if (params.withReasoning) body.reasoning_effort = "medium";

  const res = await (creds.fetch ?? fetch)(`${creds.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(creds.apiKey ? { Authorization: `Bearer ${creds.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  const contentType = res.headers.get("content-type") || "";
  const isSSE = contentType.includes("text/event-stream");

  if (!res.ok || !res.body || !isSSE) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.error?.message) {
        throw new Error(json.error.message);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(
          `ONLYOFFICE API error (${res.status}): ${text.slice(0, 200)}`
        );
      }
      throw e;
    }
    throw new Error(`ONLYOFFICE API error: ${res.status}`);
  }

  return buildAsyncIterable(res.body);
};

/**
 * Wrap a `ReadableStream` of SSE bytes as an async-iterable of parsed
 * JSON chunks. Handles line buffering across TCP reads, skips empty and
 * non-`data:` lines, and stops on the canonical `data: [DONE]` marker.
 *
 * SSE events that carry an `error.message` field are surfaced as thrown
 * `Error` so the outer `sendMessage` try/catch lands on them.
 */
const buildAsyncIterable = (body: ReadableStream<Uint8Array>) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const iterable = {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          let value: Uint8Array | undefined;
          let done: boolean;

          try {
            ({ value, done } = await reader.read());
          } catch {
            break;
          }

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(
                  parsed.error.message || "Unknown ONLYOFFICE error"
                );
              }
              yield parsed;
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };

  return iterable;
};
