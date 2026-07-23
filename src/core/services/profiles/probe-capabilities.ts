import type { Profile } from "../../types";
import { credsOf, providerFor } from "./lookup";
import { probeToolCapability } from "./probe-tools";

export type ProbedCapabilities = {
  canUseTool: boolean;
  useResponsesApi: boolean;
};

/**
 * Single capability probe that resolves `canUseTool` and `useResponsesApi`
 * together, so the two can never disagree (e.g. a reasoning model that
 * supports tools only through the Responses API used to come back as
 * `canUseTool: false` + `useResponsesApi: true`).
 *
 * Fires both transports in parallel — total latency is the slower of the
 * two, not their sum:
 *
 * - **A** — tool probe through the Responses API (`/v1/responses`). Catches
 *   gpt-5+ reasoning models that reject `tools` + `reasoning_effort` on
 *   chat completions. For non-OpenAI backends this 404s and is ignored.
 * - **B** — tool probe through chat completions (`/v1/chat/completions`).
 *   The classic path for everything else.
 *
 * Whichever emitted a `tool-call` wins; the Responses API takes precedence
 * when both succeed. Neither succeeding means the model can't call tools.
 */
export async function probeCapabilities(
  profile: Pick<Profile, "providerType" | "modelId" | "baseUrl" | "key">,
  externalSignal?: AbortSignal
): Promise<ProbedCapabilities> {
  // Only providers that actually expose the OpenAI Responses API should pay
  // for the Responses-transport tool probe. `checkResponsesApi` returns
  // `false` without a network call for every non-OpenAI backend (base-class
  // default), so we skip a probe that would otherwise 404 against
  // `/v1/responses` on every profile save for the 15 other providers.
  let supportsResponses = false;
  try {
    const Provider = await providerFor(profile.providerType);
    supportsResponses = await new Provider(credsOf(profile)).checkResponsesApi(
      profile.modelId,
      externalSignal
    );
  } catch {
    supportsResponses = false;
  }

  const [viaResponses, viaChat] = await Promise.all([
    supportsResponses
      ? probeToolCapability(profile, true, externalSignal)
      : Promise.resolve(false),
    probeToolCapability(profile, false, externalSignal),
  ]);

  if (viaResponses) return { canUseTool: true, useResponsesApi: true };
  if (viaChat) return { canUseTool: true, useResponsesApi: false };
  return { canUseTool: false, useResponsesApi: false };
}
