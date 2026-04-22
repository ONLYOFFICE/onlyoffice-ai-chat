import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, TMCPItem, TProvider } from "../types";

export type TData = {
  url: string;
  apiKey?: string;
};

export type TErrorData = {
  field: "key" | "url" | "name";
  message: string;
};

/**
 * Abstract base class for all AI providers.
 * Implements common properties and methods shared across providers.
 *
 * Each concrete provider must implement the abstract methods to integrate
 * with a specific AI service (OpenAI, Anthropic, Ollama, etc.). The class
 * handles common concerns like model selection, system prompts, stream
 * interruption, and API key/URL management.
 *
 * @typeParam TOOL - Provider-specific tool format passed to the SDK
 *   (e.g., `ToolUnion` for Anthropic, `ChatCompletionTool` for OpenAI).
 * @typeParam MESSAGE - Provider-specific message/conversation format
 *   (e.g., `MessageParam` for Anthropic, `ChatCompletionMessageParam` for OpenAI).
 * @typeParam CLIENT - Provider-specific SDK client instance
 *   (e.g., `Anthropic`, `OpenAI`, `Ollama`).
 *
 * @example
 * ```ts
 * import { AbstractBaseProvider, TData, TErrorData } from "./base";
 * import type { ThreadMessageLike } from "@assistant-ui/react";
 * import type { Model, TMCPItem, TProvider } from "../types";
 *
 * type MyTool = { name: string; description: string };
 * type MyMessage = { role: string; content: string };
 * type MyClient = { chat(messages: MyMessage[]): AsyncIterable<string> };
 *
 * class MyCustomProvider extends AbstractBaseProvider<MyTool, MyMessage, MyClient> {
 *   constructor() {
 *     super();
 *     this.client = createMyClient();
 *   }
 *
 *   setProvider(provider: TProvider): void {
 *     this.url = provider.url;
 *     this.apiKey = provider.apiKey;
 *   }
 *
 *   setPrevMessages(prevMessages: ThreadMessageLike[]): void {
 *     this.prevMessages = prevMessages.map(convertToMyFormat);
 *   }
 *
 *   setTools(tools: TMCPItem[]): void {
 *     this.tools = tools.map(convertToolToMyFormat);
 *   }
 *
 *   getName(): string { return "my-provider"; }
 *   getBaseUrl(): string { return "https://api.my-provider.com"; }
 *
 *   async createChatName(message: string): Promise<string> {
 *     return message.slice(0, 50);
 *   }
 *
 *   async *sendMessage(messages: ThreadMessageLike[]): AsyncGenerator<ThreadMessageLike> {
 *     // Convert messages, call SDK, yield streamed chunks
 *   }
 *
 *   async *sendMessageAfterToolCall(message: ThreadMessageLike): AsyncGenerator<ThreadMessageLike> {
 *     // Resume generation after a tool result is appended
 *   }
 *
 *   async checkProvider(data: TData): Promise<boolean | TErrorData> {
 *     // Validate credentials; return true on success or TErrorData on failure
 *     return true;
 *   }
 *
 *   async getProviderModels(data: TData): Promise<Model[]> {
 *     // Fetch available models from the remote API
 *     return [];
 *   }
 * }
 * ```
 */
export abstract class AbstractBaseProvider<TOOL, MESSAGE, CLIENT> {
  // Common properties
  modelKey = "";
  systemPrompt = "";
  apiKey?: string;
  url?: string;
  provider?: TProvider;
  isReasoning = false;

  // Provider-specific properties (typed by generics)
  client?: CLIENT;
  tools: TOOL[] = [];
  prevMessages: MESSAGE[] = [];

  // Stop flag for interrupting streams
  protected stopFlag = false;

  // ============================================
  // Common methods (identical across providers)
  // ============================================

  setModelKey = (modelKey: string): void => {
    this.modelKey = modelKey;
  };

  setSystemPrompt = (systemPrompt: string): void => {
    this.systemPrompt = systemPrompt;
  };

  stopMessage = (): void => {
    this.stopFlag = true;
  };

  /**
   * Sets the API key. Override in subclasses if the client needs special handling.
   * By default, stores the key and attempts to update the client's apiKey property.
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;

    const client = this.client as Record<string, unknown> | undefined;
    if (client && "apiKey" in client) {
      client.apiKey = apiKey;
    }
  }

  /**
   * Sets the base URL. Override in subclasses if the client needs special handling.
   * By default, stores the URL and attempts to update the client's baseURL property.
   */
  setUrl(url: string): void {
    this.url = url;

    const client = this.client as Record<string, unknown> | undefined;
    if (client && "baseURL" in client) {
      client.baseURL = url;
    }
  }

  // ============================================
  // Abstract methods (must be implemented by subclasses)
  // ============================================

  /**
   * Configures the provider from a stored {@link TProvider} profile.
   * Implementations should extract the URL, API key, and any other
   * provider-specific settings, then initialize or reconfigure the SDK client.
   *
   * @param provider - The provider profile containing connection details.
   */
  abstract setProvider(provider: TProvider): void;

  /**
   * Converts thread history into the provider's native message format and
   * stores it in {@link prevMessages}. Called before each
   * {@link sendMessage} invocation so the provider has conversation context.
   *
   * @param prevMessages - Previous messages in the assistant-ui format.
   */
  abstract setPrevMessages(prevMessages: ThreadMessageLike[]): void;

  /**
   * Converts MCP tool definitions into the provider's native tool format
   * and stores them in {@link tools}. Called whenever the active tool set
   * changes (e.g., an MCP server connects or disconnects).
   *
   * @param tools - Tool definitions from MCP servers, web search, or host tools.
   */
  abstract setTools(tools: TMCPItem[]): void;

  /**
   * Generates a short, human-readable title for a new chat thread based
   * on the first user message. Typically calls the model with a
   * summarization prompt.
   *
   * @param message - The first user message in the thread.
   * @returns A short title string (ideally under 60 characters).
   */
  abstract createChatName(message: string): Promise<string>;

  /**
   * Streams a response from the provider for the given messages.
   * Yields intermediate {@link ThreadMessageLike} chunks as they arrive
   * and a final object with `{ isEnd: true, responseMessage }` when the
   * stream completes. Implementations must respect {@link stopFlag} to
   * allow the user to interrupt generation.
   *
   * @param messages - The full conversation (system + user + assistant messages).
   * @param afterToolCall - Whether this call follows a tool-use turn.
   * @param message - An optional single message to append (used after tool calls).
   * @param withThinking - Whether to request extended thinking / chain-of-thought.
   * @yields Streamed message chunks, ending with `{ isEnd: true, responseMessage }`.
   */
  abstract sendMessage(
    messages: ThreadMessageLike[],
    afterToolCall?: boolean,
    message?: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  >;

  /**
   * Resumes streaming after a tool call has been executed and its result
   * appended to the conversation. The provider re-sends the conversation
   * (including tool results) so the model can continue its response.
   *
   * @param message - The tool-result message to append before continuing.
   * @param withThinking - Whether to request extended thinking / chain-of-thought.
   * @yields Streamed message chunks, ending with `{ isEnd: true, responseMessage }`.
   */
  abstract sendMessageAfterToolCall(
    message: ThreadMessageLike,
    withThinking?: boolean
  ): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  >;

  /**
   * Returns the unique identifier string for this provider type
   * (e.g., `"openai"`, `"anthropic"`, `"ollama"`). Must match the key
   * used in the provider registry.
   *
   * @returns The provider type identifier.
   */
  abstract getName(): string;

  /**
   * Returns the default base URL for this provider's API
   * (e.g., `"https://api.openai.com/v1"`). Used as a fallback when the
   * user has not configured a custom URL.
   *
   * @returns The default API base URL.
   */
  abstract getBaseUrl(): string;

  /**
   * Validates provider credentials (API key and/or URL) by making a
   * lightweight request to the provider's API.
   *
   * @param data - The URL and optional API key to validate.
   * @returns `true` if the credentials are valid, or a {@link TErrorData}
   *   object describing which field failed and why.
   */
  abstract checkProvider(data: TData): Promise<boolean | TErrorData>;

  /**
   * Fetches the list of available models from the provider's API.
   * Used to populate model selection dropdowns in the UI.
   *
   * @param data - The URL and optional API key to authenticate with.
   * @returns An array of {@link Model} objects the provider supports.
   */
  abstract getProviderModels(data: TData): Promise<Model[]>;

  /**
   * One-shot, non-streaming chat request.
   *
   * Sends exactly the provided messages to the model and returns the
   * assistant's reply as plain text. Intentionally standalone:
   *
   * - **No streaming** — uses the provider SDK's non-stream API.
   * - **No history** — does NOT read or mutate {@link prevMessages};
   *   only the messages passed in are sent.
   * - **No tools** — tools are deliberately omitted so the model
   *   produces a text answer rather than a tool call.
   *
   * Intended for host-driven one-off calls (e.g. vision, OCR,
   * summarisation prompts) where thread state must not be touched.
   * Each provider implements this directly against its SDK.
   *
   * @param messages     Messages to send in this single turn.
   * @param systemPrompt Optional system prompt override. When omitted,
   *   {@link systemPrompt} is used.
   * @returns The assistant's reply text (empty string on failure).
   */
  abstract sendMessageSync(
    messages: ThreadMessageLike[],
    systemPrompt?: string
  ): Promise<string>;

  // ============================================
  // Concrete methods (overridable by subclasses)
  // ============================================

  /**
   * Image generation. Returns base64-encoded image data.
   * Only providers with CapabilitiesUI.Image should implement this.
   */
  async imageGeneration?(request: {
    prompt: string;
    width?: number;
    height?: number;
  }): Promise<string>;

  /**
   * Image analysis — sends an image with a prompt and returns text response.
   */
  async imageVision(request: {
    image: string;
    prompt: string;
  }): Promise<string> {
    const message: ThreadMessageLike = {
      role: "user",
      content: [
        { type: "text", text: request.prompt },
        { type: "image", image: request.image },
      ],
    };
    return this.sendMessageSync([message]);
  }

  /**
   * OCR — extracts text from an image.
   */
  async imageOCR(request: { image: string }): Promise<string> {
    return this.imageVision({
      image: request.image,
      prompt:
        "Extract all text from this image exactly as it appears. Preserve the original formatting, line breaks, and structure.",
    });
  }

  /**
   * Whether this provider supports streaming responses.
   */
  isSupportStreaming(): boolean {
    return true;
  }
}
