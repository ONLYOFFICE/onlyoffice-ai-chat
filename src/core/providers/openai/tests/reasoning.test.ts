import { describe, expect, it } from "vitest";
import { NO_REASONING_SUPPORT } from "../../../../shared/reasoning-level";
import {
  getOpenAIReasoningSupport,
  resolveReasoningEffort,
  resolveReasoningParam,
  supportsMaxReasoning,
  supportsNoneReasoning,
  supportsXhighReasoning,
} from "../reasoning";

describe("supportsNoneReasoning", () => {
  it("is true for non-pro gpt-5.1 and newer (5.1, 5.2, 5.5)", () => {
    expect(supportsNoneReasoning("gpt-5.1")).toBe(true);
    expect(supportsNoneReasoning("gpt-5.2-2025-12-11")).toBe(true);
    expect(supportsNoneReasoning("gpt-5.5")).toBe(true);
  });

  it("is false for pro variants (no effort below medium)", () => {
    expect(supportsNoneReasoning("gpt-5.5-pro")).toBe(false);
    expect(supportsNoneReasoning("gpt-5.1-pro")).toBe(false);
    expect(supportsNoneReasoning("gpt-5-pro")).toBe(false);
  });

  it("is false for gpt-5(.0), o-series and non-reasoning models", () => {
    expect(supportsNoneReasoning("gpt-5")).toBe(false);
    expect(supportsNoneReasoning("o3")).toBe(false);
    expect(supportsNoneReasoning("gpt-4o")).toBe(false);
    expect(supportsNoneReasoning("grok-reasoning-1")).toBe(false);
  });
});

describe("getOpenAIReasoningSupport", () => {
  it("describes each family per OpenAI's tables", () => {
    expect(getOpenAIReasoningSupport("gpt-4o")).toEqual(NO_REASONING_SUPPORT);
    expect(getOpenAIReasoningSupport("gpt-5")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high"],
    });
    expect(getOpenAIReasoningSupport("o4-mini")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high"],
    });
    expect(getOpenAIReasoningSupport("gpt-5.1")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high"],
    });
    expect(getOpenAIReasoningSupport("gpt-5.2")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    });
    expect(getOpenAIReasoningSupport("gpt-5.5-pro")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["medium", "high", "max"],
    });
    expect(getOpenAIReasoningSupport("gpt-6-astra")).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high", "max"],
    });
  });

  it("assumes low / medium / high for unknown ids, off omitting the field", () => {
    expect(getOpenAIReasoningSupport("llama3.3:70b")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high"],
    });
    expect(resolveReasoningEffort("llama3.3:70b", "off")).toBeUndefined();
  });
});

describe("supportsXhighReasoning", () => {
  it("is true for gpt-5.2 and newer and the codex-max variants", () => {
    expect(supportsXhighReasoning("gpt-5.2")).toBe(true);
    expect(supportsXhighReasoning("gpt-5.5-2026-03-01")).toBe(true);
    expect(supportsXhighReasoning("gpt-5.1-codex-max")).toBe(true);
  });

  it("is false for gpt-5.0 / 5.1, the o-series and non-reasoning models", () => {
    expect(supportsXhighReasoning("gpt-5")).toBe(false);
    expect(supportsXhighReasoning("gpt-5.1")).toBe(false);
    expect(supportsXhighReasoning("o3")).toBe(false);
    expect(supportsXhighReasoning("gpt-4o")).toBe(false);
  });
});

describe("supportsMaxReasoning", () => {
  it("is true for gpt-5.5 and newer and the gpt-6 family", () => {
    expect(supportsMaxReasoning("gpt-5.5")).toBe(true);
    expect(supportsMaxReasoning("gpt-5.6-terra")).toBe(true);
    expect(supportsMaxReasoning("gpt-6-astra")).toBe(true);
  });

  it("is false for gpt-5.0 – 5.4, the o-series and non-reasoning models", () => {
    expect(supportsMaxReasoning("gpt-5.2")).toBe(false);
    expect(supportsMaxReasoning("gpt-5")).toBe(false);
    expect(supportsMaxReasoning("o3")).toBe(false);
    expect(supportsMaxReasoning("gpt-4o")).toBe(false);
  });
});

describe("resolveReasoningEffort", () => {
  it("passes low / medium / high through on reasoning models", () => {
    expect(resolveReasoningEffort("gpt-5.5", "low")).toBe("low");
    expect(resolveReasoningEffort("o3", "high")).toBe("high");
    // Ids an OpenAI-compatible backend serves are assumed to reason.
    expect(resolveReasoningEffort("qwen3:8b", "medium")).toBe("medium");
    expect(resolveReasoningEffort("gpt-oss:20b", "max")).toBe("high");
  });

  it("sends nothing at all to models that do not think", () => {
    expect(resolveReasoningEffort("gpt-4o", "medium")).toBeUndefined();
    expect(resolveReasoningEffort("gpt-4.1-mini", "high")).toBeUndefined();
    expect(resolveReasoningEffort("gpt-4o", "off")).toBeUndefined();
  });

  it("sends max, xhigh or high for max depending on what the model documents", () => {
    expect(resolveReasoningEffort("gpt-5.5", "max")).toBe("max");
    expect(resolveReasoningEffort("gpt-6-astra", "max")).toBe("max");
    expect(resolveReasoningEffort("gpt-5.2", "max")).toBe("xhigh");
    expect(resolveReasoningEffort("gpt-5.1-codex-max", "max")).toBe("xhigh");
    // A rejected value is a 400, so everything else clamps to high.
    expect(resolveReasoningEffort("gpt-5.1", "max")).toBe("high");
    expect(resolveReasoningEffort("o3", "max")).toBe("high");
  });

  it("sends the standard depth when off on models that cannot stop", () => {
    expect(resolveReasoningEffort("gpt-6-astra", "off")).toBe("medium");
    expect(resolveReasoningEffort("gpt-5", "off")).toBe("medium");
    expect(resolveReasoningEffort("o3", "off")).toBe("medium");
    expect(resolveReasoningEffort("gpt-6-pro", "off")).toBe("medium");
  });

  it("returns none when off for models that support it", () => {
    expect(resolveReasoningEffort("gpt-5.5", "off")).toBe("none");
    expect(resolveReasoningEffort("gpt-5.1", "off")).toBe("none");
  });

  it("never goes below medium on pro models", () => {
    expect(resolveReasoningEffort("gpt-5.5-pro", "low")).toBe("medium");
    expect(resolveReasoningEffort("gpt-5.5-pro", "medium")).toBe("medium");
    expect(resolveReasoningEffort("gpt-5.5-pro", "off")).toBe("medium");
  });

  it("returns undefined when off for models that do not think", () => {
    expect(resolveReasoningEffort("gpt-4o", "off")).toBeUndefined();
    expect(resolveReasoningEffort("gpt-4.1", "off")).toBeUndefined();
  });
});

describe("resolveReasoningParam", () => {
  it("asks for a summary only when reasoning is on and the caller wants it", () => {
    expect(
      resolveReasoningParam("gpt-5.1", "medium", { summary: true })
    ).toEqual({
      effort: "medium",
      summary: "auto",
    });
  });

  it("omits the summary for callers that read only the final text", () => {
    expect(resolveReasoningParam("gpt-5.1", "high")).toEqual({
      effort: "high",
    });
  });

  it("never asks for a summary with reasoning off", () => {
    // gpt-5.0 still reasons at its floor with the toggle off, so a summary
    // here would surface a thinking block the user switched off.
    expect(resolveReasoningParam("gpt-5.1", "off", { summary: true })).toEqual({
      effort: "none",
    });
    expect(resolveReasoningParam("gpt-5", "off", { summary: true })).toEqual({
      effort: "medium",
    });
    expect(
      resolveReasoningParam("gpt-4o", "off", { summary: true })
    ).toBeUndefined();
  });
});
