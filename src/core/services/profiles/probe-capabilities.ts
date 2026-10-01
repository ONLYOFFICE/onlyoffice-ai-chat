import type { ProviderCredentials } from "../../../shared/provider-credentials";
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
 * Probes the transports in order, stopping at the first that emits a
 * `tool-call`:
 *
 * - **A** — tool probe through the Responses API (`/v1/responses`), only
 *   when the provider reports one. Catches gpt-5+ reasoning models that
 *   reject `tools` + `reasoning_effort` on chat completions.
 * - **B** — tool probe through chat completions (`/v1/chat/completions`),
 *   when A was skipped or failed. The classic path for everything else.
 *
 * Sequential rather than parallel: for the models A exists for, B is a
 * guaranteed 400 (a model that cannot stop thinking always carries
 * `reasoning_effort`), which the provider logs as an error on every
 * profile save and bills as a request. Neither succeeding means the model
 * can't call tools.
 */
export async function probeCapabilities(
  profile: Pick<Profile, "providerType" | "modelId" | "baseUrl" | "key">,
  creds: ProviderCredentials = credsOf(profile),
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
    supportsResponses = await new Provider(creds).checkResponsesApi(
      profile.modelId,
      externalSignal
    );
  } catch {
    supportsResponses = false;
  }

  if (
    supportsResponses &&
    (await probeToolCapability(profile, creds, true, externalSignal))
  ) {
    return { canUseTool: true, useResponsesApi: true };
  }
  if (await probeToolCapability(profile, creds, false, externalSignal)) {
    return { canUseTool: true, useResponsesApi: false };
  }
  return { canUseTool: false, useResponsesApi: false };
}
