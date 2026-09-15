/**
 * Custom `fetch` implementation passed to SDK clients so all HTTP
 * traffic from the provider — chat completions, model listing,
 * connection probes, image generation — flows through the supplied
 * function instead of the global `fetch`. Used to route requests
 * through a host-provided CORS / auth proxy.
 */
import type { SourceMeta } from "./source-meta";

export type ProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ProviderCredentials = {
  baseUrl: string;
  apiKey?: string;
  /**
   * Override for the underlying `fetch`. When set, every request the
   * provider makes (including the SDK's internal calls) is routed
   * through this function. Leave `undefined` to use the global
   * `fetch`.
   */
  fetch?: ProviderFetch;
  /**
   * Inner provider whose response parser the `"external"` provider
   * should delegate to. Forwarded from `Profile.basedOn`; ignored by
   * every other provider.
   */
  basedOn?: import("./builtin-provider-type").BuiltinProviderType;
  /**
   * Identifier of the conversation the request belongs to (the thread
   * id). Forwarded from {@link ActionArgs.threadId} and honoured by two
   * providers: ONLYOFFICE sends it as the `x-session-id` header so the
   * backend can correlate the turns of one chat, OpenRouter as the
   * `session_id` body field that pins the turns of one chat to the
   * endpoint holding the warm cache. Every other provider ignores it, so
   * no thread id leaks to any other third-party endpoint.
   */
  sessionId?: string;
  /**
   * Host entity the round runs for — typically the agent: its id and
   * human-readable title. Forwarded from {@link ActionArgs.entityId} /
   * {@link ActionArgs.entityTitle} and sent by the ONLYOFFICE provider as
   * the request's `metadata` (`agent_id` / `agent_title`); every other
   * provider ignores both.
   */
  entityId?: string;
  entityTitle?: string;
  /**
   * The entry the request is billed to — see {@link SourceMeta}. Forwarded
   * from {@link ActionArgs.source} and sent by the ONLYOFFICE provider as the
   * request's `metadata` (`source_id` / `source_type` / `source_title`);
   * when set it replaces the legacy `agent_id` / `agent_title` pair derived
   * from `entityId` / `entityTitle`. Every other provider ignores it.
   */
  source?: SourceMeta;
  /**
   * Extra HTTP headers attached to every request the provider's SDK
   * client makes. Forwarded from `Profile.headers`. A header set here
   * overrides what the SDK would derive on its own (e.g. an explicit
   * `Authorization` wins over the api-key bearer). Currently honoured by
   * the OpenAI-family providers.
   */
  headers?: Record<string, string>;
  /**
   * What the selected model can do with extended thinking, as the
   * provider's catalogue reported it at save time (`Profile.reasoningSupport`).
   * The composer builds its Effort row from this record when present, so the
   * request builders must read the same one — otherwise the row shows a
   * depth the wire never sends. Absent, each provider falls back to its
   * id-based table, which is also what the composer does.
   */
  reasoningSupport?: import("./reasoning-level").ReasoningSupport;
};
