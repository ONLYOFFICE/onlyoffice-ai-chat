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
};
