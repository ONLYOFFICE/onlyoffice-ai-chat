import { registerProvider } from "@onlyoffice/ai-chat";

const PROVIDER_TYPE = "echo";

let currentModel: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const echoProvider: any = {
  type: PROVIDER_TYPE,
  name: "Echo Provider",
  description: "A demo provider that echoes back your messages",
  defaultBaseUrl: "",
  models: [
    { id: "echo-v1", name: "Echo v1", provider: PROVIDER_TYPE },
    { id: "echo-reverse", name: "Echo Reverse", provider: PROVIDER_TYPE },
  ],

  async *sendMessage(messages: unknown[]) {
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

    const model = currentModel ?? "echo-v1";
    const reply =
      model === "echo-reverse"
        ? text.split("").reverse().join("")
        : `Echo: ${text}`;

    for (let i = 0; i < reply.length; i++) {
      await new Promise((r) => setTimeout(r, 20));
      yield { type: "text-delta" as const, textDelta: reply[i] };
    }
  },

  async *sendMessageAfterToolCall() {
    yield {
      type: "text-delta" as const,
      textDelta: "Echo: tool call completed",
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

  setProvider(provider: { model?: { id?: string } }) {
    currentModel = provider?.model?.id ?? null;
  },
  setPrevMessages() {},
  setTools() {},
  getName() {
    return PROVIDER_TYPE;
  },
  getBaseUrl() {
    return "";
  },
};

registerProvider(PROVIDER_TYPE, echoProvider);

export { PROVIDER_TYPE };
