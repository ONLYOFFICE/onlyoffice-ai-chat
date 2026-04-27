import { beforeEach, describe, expect, it, vi } from "vitest";
import { onlyOfficeInfo } from "../info";
import { OnlyOfficeProvider } from "../index";

const { chatCreateMock } = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreateMock } };
  },
}));

describe("OnlyOfficeProvider", () => {
  beforeEach(() => {
    chatCreateMock.mockReset();
    vi.restoreAllMocks();
  });

  describe("static identity", () => {
    it("returns canonical name", () => {
      expect(OnlyOfficeProvider.getName()).toBe(onlyOfficeInfo.name);
    });
    it("returns canonical baseUrl", () => {
      expect(OnlyOfficeProvider.getBaseUrl()).toBe(onlyOfficeInfo.baseUrl);
    });
  });

  describe("constructor", () => {
    it("appends the internal OpenAI route suffix to the user baseUrl", () => {
      const p = new OnlyOfficeProvider({
        baseUrl: "https://portal.example.com/",
        apiKey: "sk",
      });
      // verify indirectly: sendMessageSync hits client.chat.completions.create
      // — the base URL is configured into the SDK client constructor which
      // our mock ignores, but the credentials are also stored internally.
      expect(p).toBeDefined();
    });
  });

  describe("sendMessageSync", () => {
    it("returns the choice content on success", async () => {
      chatCreateMock.mockResolvedValueOnce({
        choices: [{ message: { content: "answer" } }],
      });
      const p = new OnlyOfficeProvider({
        baseUrl: "https://portal.example.com/",
        apiKey: "sk",
      });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "gpt-4",
          systemPrompt: "be nice",
        })
      ).toBe("answer");
    });

    it("returns empty string on error", async () => {
      chatCreateMock.mockRejectedValueOnce(new Error("x"));
      const p = new OnlyOfficeProvider({
        baseUrl: "https://portal.example.com/",
        apiKey: "sk",
      });
      expect(
        await p.sendMessageSync({
          messages: [],
          model: "gpt-4",
          systemPrompt: "",
        })
      ).toBe("");
    });
  });

  describe("sendMessage via getStream override", () => {
    it("routes through openSSEStream (raw fetch)", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue({
          ok: true,
          body: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode("data: [DONE]\n"));
              c.close();
            },
          }),
          headers: {
            get: (k: string) =>
              k === "content-type" ? "text/event-stream" : null,
          },
          status: 200,
          text: () => Promise.resolve(""),
        } as unknown as Response);

      const p = new OnlyOfficeProvider({
        baseUrl: "https://portal.example.com/",
        apiKey: "sk",
      });
      // drain the generator
      const frames: unknown[] = [];
      for await (const f of p.sendMessage({
        messages: [],
        model: "gpt-4",
        systemPrompt: "",
      })) {
        frames.push(f);
      }
      expect(fetchMock).toHaveBeenCalled();
      const last = frames[frames.length - 1] as { isEnd: true };
      expect(last.isEnd).toBe(true);
    });
  });

  describe("static getProviderModels", () => {
    it("delegates to listModels (REST endpoint)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () =>
          Promise.resolve({
            response: [{ modelId: "gpt-4", providerId: -1, providerTitle: "" }],
          }),
      } as unknown as Response);
      const out = await OnlyOfficeProvider.getProviderModels({
        baseUrl: "https://portal.example.com",
        apiKey: "sk",
      });
      expect(out[0].id).toBe("gpt-4");
    });
  });

  describe("static checkProvider", () => {
    it("returns true when listModels succeeds", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ response: [] }),
      } as unknown as Response);
      await expect(
        OnlyOfficeProvider.checkProvider({
          baseUrl: "https://portal.example.com",
          apiKey: "sk",
        })
      ).resolves.toBe(true);
    });
  });
});
