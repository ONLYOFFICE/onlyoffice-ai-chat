import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderCredentials } from "../../../../shared/provider-credentials";
import { OnlyOfficeProvider } from "../index";

const { chatCreate, responsesCreate, imagesGenerate } = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  responsesCreate: vi.fn(),
  imagesGenerate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreate } };
    responses = { create: responsesCreate };
    images = { generate: imagesGenerate };
  },
}));

/** Empty provider stream — the request body is all these tests inspect. */
const emptyStream = async function* () {};

const CREDS: ProviderCredentials = {
  baseUrl: "https://internal",
  apiKey: "k",
  entityId: "agent-7",
  entityTitle: "Support agent",
};

const METADATA = { agent_id: "agent-7", agent_title: "Support agent" };

/** Body the given mock was last called with. */
const body = (mock: typeof chatCreate): Record<string, unknown> =>
  mock.mock.calls[0]?.[0];

const drain = async (gen: AsyncGenerator<unknown>): Promise<void> => {
  for await (const _ of gen) void _;
};

const chatArgs = {
  messages: [{ role: "user" as const, content: "hi" }],
  model: "m",
  systemPrompt: "sys",
};

describe("OnlyOfficeProvider request metadata", () => {
  beforeEach(() => {
    chatCreate.mockReset();
    responsesCreate.mockReset();
    imagesGenerate.mockReset();
  });

  it("sends metadata on the streaming chat request", async () => {
    chatCreate.mockResolvedValueOnce(emptyStream());
    await drain(new OnlyOfficeProvider(CREDS).sendMessage(chatArgs));
    expect(body(chatCreate).metadata).toEqual(METADATA);
  });

  it("sends metadata on the streaming Responses request", async () => {
    responsesCreate.mockResolvedValueOnce(emptyStream());
    await drain(
      new OnlyOfficeProvider(CREDS).sendMessage({
        ...chatArgs,
        useResponsesApi: true,
      })
    );
    expect(body(responsesCreate).metadata).toEqual(METADATA);
  });

  it("sends metadata on a one-shot chat request", async () => {
    chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "out" } }],
    });
    await new OnlyOfficeProvider(CREDS).sendMessageSync(chatArgs);
    expect(body(chatCreate).metadata).toEqual(METADATA);
  });

  it("sends metadata on a one-shot Responses request", async () => {
    responsesCreate.mockResolvedValueOnce({ output_text: "out" });
    await new OnlyOfficeProvider(CREDS).sendMessageSync({
      ...chatArgs,
      useResponsesApi: true,
    });
    expect(body(responsesCreate).metadata).toEqual(METADATA);
  });

  it("sends metadata on an image-generation request", async () => {
    imagesGenerate.mockResolvedValueOnce({ data: [{ b64_json: "b" }] });
    await new OnlyOfficeProvider(CREDS).imageGeneration({
      model: "gpt-image-1",
      prompt: "a cat",
    });
    expect(body(imagesGenerate).metadata).toEqual(METADATA);
  });

  it("includes only the keys the host supplied", async () => {
    chatCreate.mockResolvedValueOnce({ choices: [] });
    await new OnlyOfficeProvider({
      baseUrl: "https://internal",
      entityId: "agent-7",
    }).sendMessageSync(chatArgs);
    expect(body(chatCreate).metadata).toEqual({ agent_id: "agent-7" });
  });

  it("omits metadata entirely when no entity is described", async () => {
    chatCreate.mockResolvedValueOnce({ choices: [] });
    await new OnlyOfficeProvider({
      baseUrl: "https://internal",
    }).sendMessageSync(chatArgs);
    expect(body(chatCreate)).not.toHaveProperty("metadata");
  });
});
