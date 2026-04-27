import { ActionType } from "../../capabilities";
import type { ChatEventBus } from "../../events/event-bus";
import logger from "../../shared/logger";
import { getActionProvider } from "../../services/action-holders";
import type { TMCPItem } from "../../types";

/**
 * Built-in image-generation tool source.
 *
 * Activated when the user assigns a non-default Image Generation profile in
 * Model Assignment. Exposes a single `generate_image` tool that, at call
 * time, routes the request to whichever provider is currently bound to
 * {@link ActionType.ImageGeneration} via the action holders.
 *
 * Mirrors the shape of {@link WebSearch}: `initTools()` rebuilds the tool
 * list and emits `tools-changed` on the shared event bus so the servers
 * store picks up the change and surfaces the tool to the chat model.
 */
class ImageGeneration {
  private tools: TMCPItem[] = [];
  private enabled = false;
  private eventBus: ChatEventBus;

  constructor(eventBus: ChatEventBus) {
    this.eventBus = eventBus;
    this.initTools();
  }

  /** Toggle availability of the image-generation tool. No-op when unchanged. */
  setEnabled = (enabled: boolean) => {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.initTools();
  };

  getEnabled = () => this.enabled;

  getTools = () => [...this.tools];

  private initTools = () => {
    this.tools = this.enabled
      ? [
          {
            name: "generate_image",
            description:
              "Generate an image from a textual description. Use this tool when the user asks to create, draw, render, or illustrate an image. Returns a base64-encoded PNG that is rendered inline in the chat.",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description:
                    "Detailed description of the image to generate.",
                },
              },
              required: ["prompt"],
            },
          },
        ]
      : [];
    this.eventBus.emit("tools-changed");
  };

  callTools = async (name: string, args: Record<string, unknown>) => {
    if (name !== "generate_image") {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    const provider = getActionProvider(ActionType.ImageGeneration);
    if (!provider || typeof provider.imageGeneration !== "function") {
      return JSON.stringify({
        error: "Image generation provider is not configured.",
      });
    }

    const prompt = typeof args.prompt === "string" ? args.prompt : "";
    if (!prompt) {
      return JSON.stringify({ error: "Missing prompt." });
    }

    try {
      const base64 = await provider.imageGeneration({ prompt });
      return JSON.stringify({ data: { base64 } });
    } catch (e) {
      logger.error("ImageGeneration error:", e);
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
}

export { ImageGeneration };
