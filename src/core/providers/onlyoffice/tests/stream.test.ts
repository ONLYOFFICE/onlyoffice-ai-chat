import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSSEStream } from "../stream";

const creds = {
  baseUrl: "https://portal.example.com/api/2.0/ai/openai/-1/v1",
  apiKey: "sk",
};

// Build a ReadableStream from a sequence of chunks.
const makeBody = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
};

const mockSseResponse = (chunks: string[]) =>
  ({
    ok: true,
    body: makeBody(chunks),
    headers: {
      get: (key: string) =>
        key === "content-type" ? "text/event-stream" : null,
    },
    status: 200,
    text: () => Promise.resolve(""),
  }) as unknown as Response;

describe("onlyoffice/stream/openSSEStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses SSE frames and yields the JSON payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockSseResponse([
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
        "data: [DONE]\n",
      ])
    );

    const iterable = await openSSEStream(creds, {
      messages: [],
      model: "gpt",
      tools: [],
    });

    const out: unknown[] = [];
    for await (const c of iterable) out.push(c);
    expect(out).toEqual([{ choices: [{ delta: { content: "hi" } }] }]);
  });

  it("skips malformed JSON frames and continues", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockSseResponse([
        "data: garbage\n",
        'data: {"ok":true}\n',
        "data: [DONE]\n",
      ])
    );

    const iterable = await openSSEStream(creds, {
      messages: [],
      model: "gpt",
      tools: [],
    });
    const out: unknown[] = [];
    for await (const c of iterable) out.push(c);
    expect(out).toEqual([{ ok: true }]);
  });

  it("throws when the SSE payload has an error field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockSseResponse(['data: {"error":{"message":"oops"}}\n'])
    );

    const iterable = await openSSEStream(creds, {
      messages: [],
      model: "gpt",
      tools: [],
    });
    await expect(
      (async () => {
        for await (const _ of iterable) void _;
      })()
    ).rejects.toThrow("oops");
  });

  it("throws a structured error on non-2xx JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      body: null,
      headers: { get: () => "application/json" },
      status: 400,
      text: () =>
        Promise.resolve(JSON.stringify({ error: { message: "bad" } })),
    } as unknown as Response);

    await expect(
      openSSEStream(creds, { messages: [], model: "g", tools: [] })
    ).rejects.toThrow("bad");
  });

  it("throws a wrapped error on non-JSON, non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      body: null,
      headers: { get: () => "application/json" },
      status: 500,
      text: () => Promise.resolve("raw text"),
    } as unknown as Response);

    await expect(
      openSSEStream(creds, { messages: [], model: "g", tools: [] })
    ).rejects.toThrow(/ONLYOFFICE API error \(500\): raw text/);
  });

  it("includes tools and reasoning_effort in the request body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockSseResponse(["data: [DONE]\n"]));

    const iterable = await openSSEStream(creds, {
      messages: [],
      model: "gpt",
      tools: [
        { type: "function", function: { name: "t", parameters: {} } },
      ] as never,
      withReasoning: true,
    });
    for await (const _ of iterable) void _;

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.tools).toHaveLength(1);
    expect(body.parallel_tool_calls).toBe(false);
    expect(body.reasoning_effort).toBe("medium");
    expect(body.stream).toBe(true);
  });

  it("omits parallel_tool_calls when no tools are provided", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockSseResponse(["data: [DONE]\n"]));
    const iterable = await openSSEStream(creds, {
      messages: [],
      model: "gpt",
      tools: [],
    });
    for await (const _ of iterable) void _;
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.parallel_tool_calls).toBeUndefined();
  });

  it("omits the Authorization header when no apiKey", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockSseResponse(["data: [DONE]\n"]));
    const iterable = await openSSEStream(
      { baseUrl: creds.baseUrl },
      { messages: [], model: "gpt", tools: [] }
    );
    for await (const _ of iterable) void _;
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });
});
