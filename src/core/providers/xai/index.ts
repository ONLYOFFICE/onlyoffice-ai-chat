import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import {
  effectiveReasoningLevel,
  type ReasoningLevel,
} from "../../../shared/reasoning-level";
import { OpenAIProvider } from "../openai";
import { xaiInfo } from "./info";
import { listModels } from "./models";
import { getXAIReasoningSupport } from "./reasoning";

/**
 * xAI (Grok) — OpenAI-compatible API. Inherits the chat/sync pipeline
 * from {@link OpenAIProvider}; overrides static identity and the model
 * list (Grok has its own capability heuristics).
 */
class XAIProvider extends OpenAIProvider {
  /**
   * `reasoning_effort` only where xAI documents it — the level is clamped
   * to {@link getXAIReasoningSupport}, so grok-3-mini gets `low` / `high`,
   * grok-4.5 `low` … `high`, grok-4.6+ up to `xhigh`, and the models that
   * reject the parameter (grok-4, 4.1-fast, code-fast) get nothing; the
   * inherited `"medium"` used to 400 there. Grok's reasoning cannot be
   * disabled, so a stored off means the standard depth, `"medium"` (`"high"`
   * on grok-3-mini, which has no medium).
   */
  private reasoningEffort(
    model: string,
    level: ReasoningLevel
  ): string | undefined {
    const support = this.reasoningSupportFor(model, getXAIReasoningSupport);
    if (support.depths.length === 0) return undefined;
    const effective = effectiveReasoningLevel(level, support);
    if (effective === "off") return undefined;
    return effective === "max" ? "xhigh" : effective;
  }

  protected override reasoningRequestFields(
    model: string,
    level: ReasoningLevel
  ): Record<string, unknown> {
    const effort = this.reasoningEffort(model, level);
    return effort ? { reasoning_effort: effort } : {};
  }

  /**
   * Responses API counterpart, for profiles the live probe moved onto
   * `/v1/responses`. The inherited OpenAI table sent `reasoning.effort` to
   * grok-4 and the other knob-less models, which 400 on it there too; this
   * keeps the xAI table on both transports. The summary is still asked for
   * when thinking is on — an endpoint that rejects it is retried without.
   */
  protected override reasoningResponsesFields(
    model: string,
    level: ReasoningLevel,
    opts?: { summary?: boolean }
  ): Record<string, unknown> {
    const effort = this.reasoningEffort(model, level);
    if (!effort) return {};
    return {
      reasoning:
        level !== "off" && opts?.summary
          ? { effort, summary: "auto" }
          : { effort },
    };
  }

  static override getName(): string {
    return xaiInfo.name;
  }

  static override getBaseUrl(): string {
    return xaiInfo.baseUrl;
  }

  static override async getProviderModels(
    creds: ProviderCredentials
  ): Promise<Model[]> {
    return listModels(creds);
  }
}

export { XAIProvider };
