import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendMessageResult } from "../../../../shared/send-message-args";
import { AbstractBaseProvider } from "../../../providers";
import { registerProvider, unregisterProvider } from "../../../providers";
import { AssignmentsEngine } from "../../assignments";
import type { StorageAdapter } from "../../../storage";
import { runCustomOnce, runCustomStream } from "../custom";

const sendMessageMock = vi.fn();
const sendMessageSyncMock = vi.fn();

class StubProvider extends AbstractBaseProvider {
  async *sendMessage(args: unknown): AsyncGenerator<SendMessageResult> {
    yield* sendMessageMock(args);
  }
  async sendMessageSync(args: unknown): Promise<string> {
    return sendMessageSyncMock(args);
  }
  static getName(): string {
    return "Stub";
  }
  static getBaseUrl(): string {
    return "https://stub";
  }
  static async checkProvider(): Promise<boolean> {
    return true;
  }
  static async getProviderModels(): Promise<[]> {
    return [];
  }
}

const STUB = "ai-custom-stub";

beforeEach(() => {
  registerProvider(STUB, StubProvider);
  sendMessageMock.mockReset();
  sendMessageSyncMock.mockReset();
});

afterEach(() => {
  unregisterProvider(STUB);
});

const userMessage: ThreadMessageLike = {
  role: "user",
  content: [{ type: "text", text: "hi" }],
};

const DATA_URL = "data:image/png;base64,AAAA";

/** Attachments storage stub whose readManyByIds returns a data-URL image. */
function makeAttachments(base64: string = DATA_URL) {
  return {
    readManyByIds: vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ id, title: "img", base64 }))
    ),
  } as unknown as import("../../../storage").AttachmentsStorage;
}

/** A user message carrying an image ref block (as the UI persists it). */
const imageRefMessage: ThreadMessageLike = {
  role: "user",
  content: [
    {
      type: "image",
      image: JSON.stringify({ ref: "att-1", title: "img", kind: "image" }),
      name: "img",
    } as unknown as Extract<
      Exclude<ThreadMessageLike["content"], string>[number],
      { type: "image" }
    >,
  ],
};

function makeAssignments() {
  const profile = {
    id: "p1",
    name: "P",
    providerType: STUB,
    baseUrl: "https://stub",
    modelId: "m",
  };
  const storage = {
    profiles: {
      readById: vi.fn(async () => profile),
    },
    assignments: {
      readByType: vi.fn(async () => "p1"),
    },
  } as unknown as StorageAdapter;
  return new AssignmentsEngine({ storage });
}

async function* arrayToStream(items: SendMessageResult[]) {
  for (const it of items) yield it;
}

describe("runCustomStream", () => {
  it("yields events from the custom action", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([
        {
          role: "assistant",
          content: [{ type: "text", text: "x" }],
        },
      ])
    );
    const assignments = makeAssignments();
    const collected: SendMessageResult[] = [];
    for await (const item of runCustomStream(
      assignments,
      {
        isStream: true,
        systemPrompt: "P",
        userMessage,
      },
      () => undefined,
      makeAttachments()
    )) {
      collected.push(item);
    }
    expect(collected).toHaveLength(1);
    expect(sendMessageMock.mock.calls[0][0].systemPrompt).toBe("P");
  });

  it("hydrates image refs to a data: URL before the provider", async () => {
    sendMessageMock.mockReturnValueOnce(
      arrayToStream([{ role: "assistant", content: [] }])
    );
    const assignments = makeAssignments();
    const attachments = makeAttachments();
    // Drain the stream.
    for await (const _ of runCustomStream(
      assignments,
      { isStream: true, systemPrompt: "P", userMessage: imageRefMessage },
      () => undefined,
      attachments
    )) {
      void _;
    }
    expect(attachments.readManyByIds).toHaveBeenCalledWith(["att-1"]);
    const sentMessages = sendMessageMock.mock.calls[0][0]
      .messages as ThreadMessageLike[];
    const part = (
      sentMessages[0].content as Array<{ type: string; image?: string }>
    )[0];
    expect(part.type).toBe("image");
    expect(part.image).toBe(DATA_URL);
  });
});

describe("runCustomOnce", () => {
  it("returns a wrapped assistant message", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("text");
    const assignments = makeAssignments();
    const result = await runCustomOnce(
      assignments,
      {
        isStream: false,
        systemPrompt: "P",
        userMessage,
      },
      () => undefined,
      makeAttachments()
    );
    expect(result).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "text" }],
    });
    expect(sendMessageSyncMock.mock.calls[0][0].systemPrompt).toBe("P");
  });

  it("hydrates image refs to a data: URL before the provider", async () => {
    sendMessageSyncMock.mockResolvedValueOnce("ok");
    const assignments = makeAssignments();
    const attachments = makeAttachments();
    await runCustomOnce(
      assignments,
      { isStream: false, systemPrompt: "P", userMessage: imageRefMessage },
      () => undefined,
      attachments
    );
    expect(attachments.readManyByIds).toHaveBeenCalledWith(["att-1"]);
    const sentMessages = sendMessageSyncMock.mock.calls[0][0]
      .messages as ThreadMessageLike[];
    const part = (
      sentMessages[0].content as Array<{ type: string; image?: string }>
    )[0];
    expect(part.image).toBe(DATA_URL);
  });
});
