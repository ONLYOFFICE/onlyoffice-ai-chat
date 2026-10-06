import { describe, expect, it } from "vitest";
import { ActionType } from "../../../../shared/action-type";
import { CapabilitiesUI } from "../../../../shared/capabilities-ui";
import {
  ACTION_REQUIREMENTS,
  defaultCanServe,
  meetsRequirements,
} from "../requirements";

describe("ACTION_REQUIREMENTS", () => {
  it("includes a requirement entry for every ActionType", () => {
    for (const type of Object.values(ActionType)) {
      expect(ACTION_REQUIREMENTS).toHaveProperty(type);
    }
  });

  it("Default has no required bits", () => {
    expect(ACTION_REQUIREMENTS[ActionType.Default]).toBe(CapabilitiesUI.None);
  });

  it("text actions require Chat", () => {
    expect(ACTION_REQUIREMENTS[ActionType.Chat]).toBe(CapabilitiesUI.Chat);
    expect(ACTION_REQUIREMENTS[ActionType.Summarization]).toBe(
      CapabilitiesUI.Chat
    );
    expect(ACTION_REQUIREMENTS[ActionType.Translation]).toBe(
      CapabilitiesUI.Chat
    );
    expect(ACTION_REQUIREMENTS[ActionType.TextAnalyze]).toBe(
      CapabilitiesUI.Chat
    );
    expect(ACTION_REQUIREMENTS[ActionType.Code]).toBe(CapabilitiesUI.Chat);
    expect(ACTION_REQUIREMENTS[ActionType.FormAnalysis]).toBe(
      CapabilitiesUI.Chat
    );
  });

  it("image-output action requires Image", () => {
    expect(ACTION_REQUIREMENTS[ActionType.ImageGeneration]).toBe(
      CapabilitiesUI.Image
    );
  });

  it("image-input actions require Vision", () => {
    expect(ACTION_REQUIREMENTS[ActionType.OCR]).toBe(CapabilitiesUI.Vision);
    expect(ACTION_REQUIREMENTS[ActionType.Vision]).toBe(CapabilitiesUI.Vision);
  });
});

describe("meetsRequirements", () => {
  it("Default is satisfied by anything (including missing capabilities)", () => {
    expect(meetsRequirements({}, ActionType.Default)).toBe(true);
    expect(meetsRequirements({ capabilities: 0 }, ActionType.Default)).toBe(
      true
    );
    expect(
      meetsRequirements(
        { capabilities: CapabilitiesUI.Chat },
        ActionType.Default
      )
    ).toBe(true);
  });

  it("undefined capabilities means default None — fails non-Default actions", () => {
    expect(meetsRequirements({}, ActionType.Chat)).toBe(false);
    expect(meetsRequirements({}, ActionType.Vision)).toBe(false);
  });

  it("matches when capability bit is set", () => {
    expect(
      meetsRequirements({ capabilities: CapabilitiesUI.Chat }, ActionType.Chat)
    ).toBe(true);
    expect(
      meetsRequirements(
        { capabilities: CapabilitiesUI.Vision },
        ActionType.Vision
      )
    ).toBe(true);
    expect(
      meetsRequirements(
        { capabilities: CapabilitiesUI.Image },
        ActionType.ImageGeneration
      )
    ).toBe(true);
  });

  it("rejects when capability bit is missing", () => {
    expect(
      meetsRequirements(
        { capabilities: CapabilitiesUI.Vision },
        ActionType.Chat
      )
    ).toBe(false);
  });

  it("matches when bit is part of a larger set", () => {
    expect(
      meetsRequirements(
        {
          capabilities:
            CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools,
        },
        ActionType.Chat
      )
    ).toBe(true);
  });
});

describe("defaultCanServe", () => {
  it("passes a profile with no declared capabilities", () => {
    expect(
      defaultCanServe({ capabilities: undefined }, ActionType.ImageGeneration)
    ).toBe(true);
    expect(
      defaultCanServe(
        { capabilities: CapabilitiesUI.None },
        ActionType.ImageGeneration
      )
    ).toBe(true);
  });

  it("rejects a declared profile that lacks the required bits", () => {
    expect(
      defaultCanServe(
        { capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Vision },
        ActionType.ImageGeneration
      )
    ).toBe(false);
    expect(
      defaultCanServe({ capabilities: CapabilitiesUI.Image }, ActionType.Chat)
    ).toBe(false);
  });

  it("passes a declared profile that has the required bits", () => {
    expect(
      defaultCanServe(
        { capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Image },
        ActionType.ImageGeneration
      )
    ).toBe(true);
  });
});
