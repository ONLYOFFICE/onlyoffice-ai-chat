import { describe, expect, it } from "vitest";
import { FULL_REASONING_SUPPORT } from "../../../../shared/reasoning-level";
import {
  getOpenRouterReasoningSupport,
  openRouterReasoningFields,
  reasoningSupportFromCatalog,
} from "../reasoning";

describe("getOpenRouterReasoningSupport", () => {
  it("applies the per-upstream exceptions", () => {
    // Claude can be switched off through OpenRouter's `none`; only the
    // always-thinking Fable / Mythos cannot.
    expect(getOpenRouterReasoningSupport("anthropic/claude-opus-5")).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    });
    expect(
      getOpenRouterReasoningSupport("anthropic/claude-fable-5.1").canDisable
    ).toBe(false);
    expect(
      getOpenRouterReasoningSupport("google/gemini-3-pro-preview")
    ).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high"],
    });
    expect(getOpenRouterReasoningSupport("x-ai/grok-4.6").canDisable).toBe(
      false
    );
  });

  it("assumes the full scale for every other route", () => {
    expect(getOpenRouterReasoningSupport("openai/gpt-5.2")).toEqual(
      FULL_REASONING_SUPPORT
    );
    expect(getOpenRouterReasoningSupport("deepseek/deepseek-v4-pro")).toEqual(
      FULL_REASONING_SUPPORT
    );
  });
});

describe("openRouterReasoningFields", () => {
  it("clamps max to high on Google routes, which OpenRouter maps down anyway", () => {
    expect(
      openRouterReasoningFields("google/gemini-3-pro-preview", "max")
    ).toEqual({ reasoning: { effort: "high" } });
  });

  it("sends none when off, and the standard depth where the route cannot stop", () => {
    expect(openRouterReasoningFields("anthropic/claude-opus-5", "off")).toEqual(
      { reasoning: { effort: "none" } }
    );
    expect(openRouterReasoningFields("openai/gpt-5.2", "off")).toEqual({
      reasoning: { effort: "none" },
    });
    expect(openRouterReasoningFields("x-ai/grok-4.6", "off")).toEqual({
      reasoning: { effort: "medium" },
    });
    expect(
      openRouterReasoningFields("anthropic/claude-fable-5.1", "off")
    ).toEqual({ reasoning: { effort: "medium" } });
  });
});

describe("reasoningSupportFromCatalog", () => {
  // Shapes taken from OpenRouter's live /models catalogue.
  it("reads the full record: efforts, mandatory, default", () => {
    expect(
      reasoningSupportFromCatalog(
        {
          mandatory: true,
          default_enabled: true,
          supported_efforts: ["xhigh", "high", "medium", "low"],
          default_effort: "high",
        },
        "x-ai/grok-4.6"
      )
    ).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high", "max"],
      defaultDepth: "high",
    });
    expect(
      reasoningSupportFromCatalog(
        {
          mandatory: false,
          default_enabled: true,
          supported_efforts: ["max", "xhigh", "high", "medium", "low"],
          default_effort: "high",
        },
        "anthropic/claude-sonnet-5"
      )
    ).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
      defaultDepth: "high",
    });
  });

  it("folds minimal into low and ignores none", () => {
    expect(
      reasoningSupportFromCatalog(
        { mandatory: false, supported_efforts: ["none", "minimal", "high"] },
        "openai/gpt-5"
      )?.depths
    ).toEqual(["low", "high"]);
  });

  it("keeps the id table's depths when the entry lists no efforts", () => {
    expect(
      reasoningSupportFromCatalog(
        { mandatory: false },
        "anthropic/claude-sonnet-4.5"
      )
    ).toEqual({
      thinks: true,
      canDisable: true,
      depths: ["low", "medium", "high", "max"],
    });
    expect(
      reasoningSupportFromCatalog({ mandatory: true }, "google/gemini-2.5-pro")
    ).toEqual({
      thinks: true,
      canDisable: false,
      depths: ["low", "medium", "high"],
    });
  });

  it("treats null as a model without thinking and undefined as unknown", () => {
    expect(reasoningSupportFromCatalog(null, "openai/gpt-4o")?.thinks).toBe(
      false
    );
    expect(reasoningSupportFromCatalog(undefined, "openai/gpt-4o")).toBe(
      undefined
    );
  });
});

describe("openRouterReasoningFields with the catalogue's support", () => {
  // The composer resolves the Effort row against `Profile.reasoningSupport`
  // (the catalogue's record) and shows the standard depth after a stored Off
  // on a mandatory route. The wire must reach the same answer from the same
  // record, not from the id table that knows nothing about the route.
  it("sends the standard depth for a stored off where the catalogue says mandatory", () => {
    const mandatory = reasoningSupportFromCatalog(
      { mandatory: true, supported_efforts: ["low", "medium", "high"] },
      "openai/gpt-6-astra"
    );
    expect(openRouterReasoningFields("openai/gpt-6-astra", "off")).toEqual({
      reasoning: { effort: "none" },
    });
    expect(
      openRouterReasoningFields("openai/gpt-6-astra", "off", mandatory)
    ).toEqual({ reasoning: { effort: "medium" } });
  });

  it("prefers the catalogue's default depth on such a route", () => {
    const support = reasoningSupportFromCatalog(
      {
        mandatory: true,
        supported_efforts: ["low", "high"],
        default_effort: "high",
      },
      "deepseek/deepseek-v4.1-flash"
    );
    expect(
      openRouterReasoningFields("deepseek/deepseek-v4.1-flash", "off", support)
    ).toEqual({ reasoning: { effort: "high" } });
  });

  it("lets the catalogue re-enable the off switch the table denies", () => {
    const switchable = reasoningSupportFromCatalog(
      { mandatory: false },
      "x-ai/grok-4.6"
    );
    expect(openRouterReasoningFields("x-ai/grok-4.6", "off")).toEqual({
      reasoning: { effort: "medium" },
    });
    expect(
      openRouterReasoningFields("x-ai/grok-4.6", "off", switchable)
    ).toEqual({ reasoning: { effort: "none" } });
  });

  it("clamps to the catalogue's depths", () => {
    const support = reasoningSupportFromCatalog(
      { mandatory: false, supported_efforts: ["low", "high"] },
      "openai/gpt-6-astra"
    );
    expect(
      openRouterReasoningFields("openai/gpt-6-astra", "medium", support)
    ).toEqual({ reasoning: { effort: "high" } });
  });
});
