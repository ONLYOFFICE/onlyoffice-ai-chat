import logger from "../../../shared/logger";
import type { Profile } from "../../types";
import { credsOf, providerFor } from "./lookup";

const PROBE_TIMEOUT_MS = 15_000;

/**
 * Live probe: ask the provider whether its model needs the Responses API
 * (`/v1/responses`). Delegates to `provider.checkResponsesApi(modelId)` —
 * the default implementation on `AbstractBaseProvider` returns `false`,
 * so third-party OpenAI-compatible providers (Together, OpenRouter, ...)
 * never make a real network call. Only the genuine `OpenAIProvider` issues
 * a probe request against `api.openai.com`.
 *
 * Mirrors {@link probeToolCapability} — 15-second timeout, never throws,
 * any error collapses to `false`.
 */
export async function probeResponsesSupport(
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
    return await provider.checkResponsesApi(profile.modelId, controller.signal);
  } catch (error) {
    logger.warn("probeResponsesSupport failed:", error);
    return false;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
