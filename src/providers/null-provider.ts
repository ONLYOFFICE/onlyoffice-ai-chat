import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model } from "../types";
import { AbstractBaseProvider, type TErrorData } from "./base";

/**
 * No-op provider used as default when no real provider is configured.
 * Eliminates null checks throughout the Provider facade class.
 */
export class NullProvider extends AbstractBaseProvider<
  unknown,
  unknown,
  unknown
> {
  // Override inherited setters to prevent mutation of shared instance
  override setModelKey = (): void => {};
  override setSystemPrompt = (): void => {};
  override setApiKey(): void {}
  override setUrl(): void {}
  override stopMessage = (): void => {};
  setProvider(): void {}

  setPrevMessages(): void {}

  setTools(): void {}

  async createChatName(): Promise<string> {
    return "";
  }

  async *sendMessage(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // No-op: yields nothing
  }

  async *sendMessageAfterToolCall(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // No-op: yields nothing
  }

  getName(): string {
    return "";
  }

  getBaseUrl(): string {
    return "";
  }

  async checkProvider(): Promise<boolean | TErrorData> {
    return false;
  }

  async getProviderModels(): Promise<Model[]> {
    return [];
  }

  isSupportStreaming(): boolean {
    return false;
  }
}

export const nullProvider = new NullProvider();
