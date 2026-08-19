/**
 * Custom `fetch` implementation passed to SDK clients so all HTTP
 * traffic from the provider — chat completions, model listing,
 * connection probes, image generation — flows through the supplied
 * function instead of the global `fetch`. Used to route requests
 * through a host-provided CORS / auth proxy.
 */
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
   * id), sent as the `x-session-id` header so the backend can correlate
   * the turns of one chat. Forwarded from {@link ActionArgs.threadId} and
   * currently honoured only by the ONLYOFFICE provider — every other
   * provider ignores it, so no thread id leaks to a third-party endpoint.
   */
  sessionId?: string;
  /**
   * Extra HTTP headers attached to every request the provider's SDK
   * client makes. Forwarded from `Profile.headers`. A header set here
   * overrides what the SDK would derive on its own (e.g. an explicit
   * `Authorization` wins over the api-key bearer). Currently honoured by
   * the OpenAI-family providers.
   */
  headers?: Record<string, string>;
};
