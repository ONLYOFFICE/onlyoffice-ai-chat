import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";
import {
  createClient,
  createEmptyResponse,
  createErrorResponse,
  createResponseShell,
  getLastToolCall,
} from "../helpers";

// Mock the Mistral SDK
vi.mock("@mistralai/mistralai", () => {
  return {
    Mistral: class MockMistral {
      apiKey: string;
      serverURL: string | undefined;
      constructor(config: { apiKey: string; serverURL?: string }) {
        this.apiKey = config.apiKey;
        this.serverURL = config.serverURL;
      }
    },
  };
});

describe("mistral helpers", () => {
  // ==========================================================================
  // createClient
  // ==========================================================================

  describe("createClient", () => {
    it("should create client with apiKey and baseUrl", () => {
      const client = createClient("test-api-key", "https://api.mistral.ai");

      expect(client).toBeDefined();
    });

    it("should create client with empty apiKey when not provided", () => {
      const client = createClient(undefined, "https://api.mistral.ai");

      expect(client).toBeDefined();
    });

    it("should create client with undefined serverURL", () => {
      const client = createClient("test-key", undefined);

      expect(client).toBeDefined();
    });

    it("should create client with no arguments", () => {
      const client = createClient();

      expect(client).toBeDefined();
    });
  });

  // ==========================================================================
  // createEmptyResponse
  // ==========================================================================

  describe("createEmptyResponse", () => {
    it("should create empty assistant response", () => {
      const result = createEmptyResponse();

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });
  });

  // ==========================================================================
  // createErrorResponse
  // ==========================================================================

  describe("createErrorResponse", () => {
    const statusOf = (msg: ThreadMessageLike) =>
      (msg as { status?: { type?: string; reason?: string } }).status;

    it("carries the error on an incomplete status, not as body text", () => {
      const result = createErrorResponse(new Error("Something went wrong"));

      expect(result.role).toBe("assistant");
      expect(result.content).toBe("");
      expect(statusOf(result)?.type).toBe("incomplete");
      expect(statusOf(result)?.reason).toBe("error");
      expect(JSON.stringify(statusOf(result))).toContain("Something went wrong");
    });

    it("handles a string error", () => {
      const result = createErrorResponse("String error");
      expect(statusOf(result)?.reason).toBe("error");
      expect(JSON.stringify(statusOf(result))).toContain("String error");
    });

    it("handles a non-Error object", () => {
      const result = createErrorResponse({ code: 500, message: "Server error" });
      expect(statusOf(result)?.type).toBe("incomplete");
      expect(statusOf(result)?.reason).toBe("error");
    });

    it("handles null and undefined", () => {
      expect(statusOf(createErrorResponse(null))?.reason).toBe("error");
      expect(statusOf(createErrorResponse(undefined))?.reason).toBe("error");
    });

    it("produces the standard incomplete-error shape", () => {
      const result = createErrorResponse(undefined);

      expect(result).toMatchObject({
        role: "assistant",
        content: "",
        status: {
          type: "incomplete",
          reason: "error",
        },
      });
    });
  });

  // ==========================================================================
  // createResponseShell
  // ==========================================================================

  describe("createResponseShell", () => {
    it("should return empty response when afterToolCall is false", () => {
      const result = createResponseShell(false, undefined);

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });

    it("should return empty response when existingMessage is undefined", () => {
      const result = createResponseShell(true, undefined);

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });

    it("should return cloned existing message when afterToolCall and existingMessage provided", () => {
      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = createResponseShell(true, existingMessage);

      expect(result).toEqual(existingMessage);
      expect(result).not.toBe(existingMessage); // Should be a clone
    });

    it("should return empty response when called with no arguments", () => {
      const result = createResponseShell();

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });
  });

  // ==========================================================================
  // getLastToolCall
  // ==========================================================================

  describe("getLastToolCall", () => {
    it("should return undefined for string content", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "Just text",
      };

      const result = getLastToolCall(message);

      expect(result).toBeUndefined();
    });

    it("should return undefined when no tool calls exist", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = getLastToolCall(message);

      expect(result).toBeUndefined();
    });

    it("should return the last tool call", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_1",
            toolName: "first_tool",
            args: {},
            argsText: "{}",
          },
          { type: "text", text: "Some text" },
          {
            type: "tool-call",
            toolCallId: "tool_2",
            toolName: "last_tool",
            args: { key: "value" },
            argsText: '{"key":"value"}',
          },
        ],
      };

      const result = getLastToolCall(message);

      expect(result).toBeDefined();
      expect(result?.toolCallId).toBe("tool_2");
      expect(result?.toolName).toBe("last_tool");
    });

    it("should return tool call when it is the only content", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_only",
            toolName: "single_tool",
            args: {},
            argsText: "{}",
          },
        ],
      };

      const result = getLastToolCall(message);

      expect(result?.toolCallId).toBe("tool_only");
    });

    it("should return undefined for empty content array", () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [],
      };

      const result = getLastToolCall(message);

      expect(result).toBeUndefined();
    });
  });
});
