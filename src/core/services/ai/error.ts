/**
 * Serializable error payload attached to `message-incomplete` events.
 *
 * `Error` instances are useless on the wire: `message`, `stack`, and
 * `name` are non-enumerable, so `JSON.stringify(err)` collapses to
 * `{}` (or `{ "cause": {} }`). The engine normalizes every error
 * through {@link toChatError} before yielding it so hosts can pipe the
 * NDJSON stream through stock `JSON.stringify` and the UI can render
 * the message without falling back to `[object Object]`.
 */
export type ChatErrorPayload = {
  /**
   * Stable machine-readable code. One of a canonical set —
   * `"auth"`, `"model_not_found"`, `"rate_limit"`, `"timeout"`,
   * `"network"`, `"bad_request"`, `"server"`, `"not_found"`,
   * `"insufficient_funds"`, `"aborted"`, `"unknown"` — or a
   * provider-specific string when the SDK supplies one verbatim.
   */
  code: string;
  /** Human-readable, end-user-safe message. */
  message: string;
  /** Optional nested cause, normalized through the same helper. */
  cause?: ChatErrorPayload;
  // Open index signature so the payload satisfies `ReadonlyJSONValue`
  // from assistant-stream — that's the type assistant-ui uses for
  // `MessageStatus.error`. Extra fields are not part of the contract.
  [key: string]: unknown;
};

type WithStatus = {
  status?: number;
  code?: string | null;
  type?: string | null;
  error?: { type?: string | null; code?: string | null; message?: string };
};

/**
 * Whether a 400's text says the model itself is missing or gone — as
 * opposed to merely mentioning the model while rejecting a parameter.
 * Anthropic answers an unsupported thinking switch with `"thinking.type.
 * enabled" is not supported for this model`; the bare word test turned
 * that into "Selected model unavailable" with a Retry button that could
 * not help (Bug 83703). Only the phrasings providers use for a missing
 * model count, in either word order: `The model X does not exist`,
 * `unknown model`, `models/X is no longer available`.
 */
function isModelNotFoundMessage(message: string): boolean {
  return (
    /\bmodels?\b.{0,80}?\b(?:not found|does(?:n't| not) exist|no longer (?:available|exists|supported)|(?:is )?(?:not available|unavailable)|(?:has been |is )?(?:deprecated|retired|decommissioned))\b/i.test(
      message
    ) ||
    /\b(?:unknown|invalid|unsupported|unrecognized|no such)\s+model\b/i.test(
      message
    )
  );
}

/**
 * Map a JS `Error` (typically an SDK API error) to a stable
 * {@link ChatErrorPayload.code}. Covers the OpenAI / Anthropic /
 * GenAI shape (`status` + `code` + nested `error.type`) and a few
 * generic patterns (`AbortError`, `TypeError: fetch failed`, timeouts).
 */
function classifyErrorCode(err: Error): string {
  if (err.name === "AbortError") return "aborted";

  const apiErr = err as Error & WithStatus;
  const status = apiErr.status;
  const apiCode = apiErr.code ?? apiErr.error?.code ?? null;
  const apiType = apiErr.type ?? apiErr.error?.type ?? null;

  if (status === 401 || status === 403) return "auth";
  if (status === 404) {
    return /model/i.test(err.message) ? "model_not_found" : "not_found";
  }
  if (status === 402) return "insufficient_funds";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status === 400) {
    if (apiCode === "model_not_found" || isModelNotFoundMessage(err.message)) {
      return "model_not_found";
    }
    return "bad_request";
  }
  if (typeof status === "number" && status >= 500) return "server";

  if (apiCode === "invalid_api_key") return "auth";
  if (apiType === "authentication_error") return "auth";
  if (apiType === "rate_limit_error") return "rate_limit";
  if (apiType === "not_found_error" && /model/i.test(err.message)) {
    return "model_not_found";
  }

  if (err.name === "TypeError" && /fetch|network/i.test(err.message)) {
    return "network";
  }
  if (/timeout/i.test(err.message)) return "timeout";
  // Message-based fallback for transports that drop the numeric status
  // (proxies that re-wrap the body, NDJSON `{ type: "error", message }`
  // envelopes). Provider text is typically "402 — insufficient funds to
  // complete this request".
  if (/insufficient funds/i.test(err.message)) return "insufficient_funds";

  return "unknown";
}

/**
 * Normalize any thrown value into a JSON-serializable
 * {@link ChatErrorPayload}. Idempotent: passing a payload back
 * through returns an equivalent payload.
 */
export function toChatError(err: unknown): ChatErrorPayload {
  if (err === null || err === undefined) {
    return { code: "unknown", message: "Unknown error" };
  }

  if (typeof err === "string") {
    return { code: "unknown", message: err };
  }

  if (typeof err !== "object") {
    return { code: "unknown", message: String(err) };
  }

  if (err instanceof Error) {
    const code = classifyErrorCode(err);
    const message = err.message || code;
    const payload: ChatErrorPayload = { code, message };
    const cause = (err as { cause?: unknown }).cause;
    if (cause !== null && cause !== undefined && cause !== err) {
      payload.cause = toChatError(cause);
    }
    return payload;
  }

  const obj = err as Record<string, unknown>;
  // Already a ChatErrorPayload — pass through (idempotency).
  if (typeof obj.code === "string" && typeof obj.message === "string") {
    const payload: ChatErrorPayload = {
      code: obj.code,
      message: obj.message,
    };
    if (obj.cause !== null && obj.cause !== undefined) {
      payload.cause = toChatError(obj.cause);
    }
    return payload;
  }

  const message =
    typeof obj.message === "string"
      ? obj.message
      : typeof obj.error === "string"
        ? obj.error
        : "Unknown error";
  const code =
    typeof obj.code === "string"
      ? obj.code
      : typeof obj.type === "string"
        ? obj.type
        : "unknown";
  return { code, message };
}
