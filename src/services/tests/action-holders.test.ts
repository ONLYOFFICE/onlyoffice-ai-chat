import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProvider = {
  setProvider: vi.fn(),
  setSystemPrompt: vi.fn(),
  setModelKey: vi.fn(),
  isReasoning: false,
};

vi.mock("../../providers/registry", () => ({
  createProvider: vi.fn(() => ({ ...mockProvider })),
}));

vi.mock("../../providers/prompts", () => ({
  SYSTEM_PROMPT: "You are a helpful assistant.",
  buildSystemPrompt: () => "You are a helpful assistant.",
  getSystemPromptAppendix: () => "",
  setSystemPromptAppendix: () => undefined,
}));

import {
  initActionHolders,
  getActionProvider,
  applyProfileToAction,
} from "../action-holders";
import { ActionType } from "../../capabilities";
import type { Profile } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: "p1",
    name: "Test",
    providerType: "openai",
    baseUrl: "https://api.openai.com",
    key: "sk-test",
    modelId: "gpt-4",
    ...overrides,
  };
}

describe("action-holders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initActionHolders", () => {
    it("creates holders for all action types", () => {
      initActionHolders();
      for (const actionType of Object.values(ActionType)) {
        // Should not throw — holder exists
        expect(() =>
          applyProfileToAction(actionType, null, null)
        ).not.toThrow();
      }
    });
  });

  describe("getActionProvider", () => {
    it("returns undefined before profile is applied", () => {
      initActionHolders();
      expect(getActionProvider(ActionType.Chat)).toBeUndefined();
    });

    it("returns provider after profile is applied", () => {
      initActionHolders();
      applyProfileToAction(ActionType.Chat, makeProfile(), null);
      expect(getActionProvider(ActionType.Chat)).toBeDefined();
    });
  });

  describe("applyProfileToAction", () => {
    it("uses taskProfile when provided", () => {
      initActionHolders();
      const profile = makeProfile();
      applyProfileToAction(ActionType.Summarization, profile, null);
      const provider = getActionProvider(ActionType.Summarization);
      expect(provider).toBeDefined();
    });

    it("falls back to defaultProfile when taskProfile is null", () => {
      initActionHolders();
      const fallback = makeProfile({ id: "default" });
      applyProfileToAction(ActionType.Translation, null, fallback);
      const provider = getActionProvider(ActionType.Translation);
      expect(provider).toBeDefined();
    });

    it("clears provider when both profiles are null", () => {
      initActionHolders();
      applyProfileToAction(ActionType.OCR, makeProfile(), null);
      expect(getActionProvider(ActionType.OCR)).toBeDefined();
      applyProfileToAction(ActionType.OCR, null, null);
      expect(getActionProvider(ActionType.OCR)).toBeUndefined();
    });

    it("no-op for unknown action type (no holder)", () => {
      // Don't init — no holders
      expect(() =>
        applyProfileToAction("Unknown" as ActionType, makeProfile(), null)
      ).not.toThrow();
    });
  });
});
