import { registerProvider } from "@onlyoffice/ai-chat";

const PROVIDER_TYPE = "echo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const echoProvider: any = {
  // --- State ---
  currentModel: null as string | null,
  isReasoning: false,
  stopFlag: false,
  prevMessages: [] as unknown[],
  systemPrompt: "",
  modelKey: "",

  // --- Required metadata ---
  type: PROVIDER_TYPE,
  name: "Echo Provider",
  description: "A demo provider that echoes back your messages",
  defaultBaseUrl: "http://localhost",
  models: [
    { id: "echo-v1", name: "Echo v1", provider: PROVIDER_TYPE },
    { id: "echo-reverse", name: "Echo Reverse", provider: PROVIDER_TYPE },
  ],

  // --- Lifecycle methods ---
  setProvider(provider: { model?: { id?: string } }) {
    echoProvider.currentModel = provider?.model?.id ?? null;
  },
  setPrevMessages(messages: unknown[]) {
    echoProvider.prevMessages = messages;
  },
  setTools() {},
  setSystemPrompt(prompt: string) {
    echoProvider.systemPrompt = prompt;
  },
  setModelKey(key: string) {
    echoProvider.modelKey = key;
  },
  stop() {
    echoProvider.stopFlag = true;
  },
  getName() {
    return PROVIDER_TYPE;
  },
  getBaseUrl() {
    return "http://localhost";
  },

  // --- Core methods ---
  async *sendMessage(messages: unknown[]) {
    echoProvider.stopFlag = false;
    const last = messages[messages.length - 1];
    const text =
      typeof last === "object" && last !== null && "content" in last
        ? String(
            Array.isArray((last as { content: unknown }).content)
              ? (last as { content: { type: string; text?: string }[] }).content
                  .filter((p) => p.type === "text" || p.type === "ui")
                  .map((p) => p.text ?? "")
                  .join("")
              : (last as { content: unknown }).content
          )
        : "";

    const model = echoProvider.currentModel ?? "echo-v1";
    const reply =
      model === "echo-reverse"
        ? text.split("").reverse().join("")
        : `Echo: ${text}`;

    let accumulated = "";
    for (let i = 0; i < reply.length; i++) {
      if (echoProvider.stopFlag) return;
      await new Promise((r) => setTimeout(r, 20));
      accumulated += reply[i];
      yield {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: accumulated }],
      };
    }

    yield {
      isEnd: true,
      responseMessage: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: accumulated }],
      },
    };
  },

  async *sendMessageAfterToolCall() {
    const text = "Echo: tool call completed";
    yield {
      role: "assistant" as const,
      content: [{ type: "text" as const, text }],
    };
    yield {
      isEnd: true,
      responseMessage: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text }],
      },
    };
  },

  async checkProvider() {
    return true;
  },

  async getProviderModels() {
    return [
      { id: "echo-v1", name: "Echo v1", provider: PROVIDER_TYPE },
      { id: "echo-reverse", name: "Echo Reverse", provider: PROVIDER_TYPE },
    ];
  },

  async createChatName(message: string) {
    return message.slice(0, 30);
  },
};

registerProvider(PROVIDER_TYPE, echoProvider);

export { PROVIDER_TYPE };
