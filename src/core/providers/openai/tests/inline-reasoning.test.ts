import { describe, expect, it } from "vitest";
import {
  InlineReasoningSplitter,
  stripInlineReasoning,
} from "../inline-reasoning";

/**
 * Feed a whole response through the splitter one chunk at a time and
 * concatenate both halves — mirrors what `processStream` accumulates.
 */
const run = (chunks: string[]) => {
  const splitter = new InlineReasoningSplitter();
  let text = "";
  let reasoning = "";
  for (const chunk of chunks) {
    const split = splitter.push(chunk);
    text += split.text;
    reasoning += split.reasoning;
  }
  const tail = splitter.flush();
  return { text: text + tail.text, reasoning: reasoning + tail.reasoning };
};

/** Split a string into fixed-size chunks to simulate arbitrary SSE framing. */
const chunked = (input: string, size: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < input.length; i += size)
    out.push(input.slice(i, i + size));
  return out;
};

describe("InlineReasoningSplitter — think tags", () => {
  it("routes a <think> span to reasoning and keeps the answer as text", () => {
    const { text, reasoning } = run([
      "<think>Okay, the user wants a paragraph about coffee.</think>",
      "Coffee is a brewed drink.",
    ]);

    expect(reasoning).toBe("Okay, the user wants a paragraph about coffee.");
    expect(text).toBe("Coffee is a brewed drink.");
  });

  it("handles a tag split across chunk boundaries", () => {
    const { text, reasoning } = run(["<thi", "nk>hmm", "</thi", "nk>Answer."]);

    expect(reasoning).toBe("hmm");
    expect(text).toBe("Answer.");
  });

  it("survives any chunk framing of the same response", () => {
    const source = "<think>deliberating here</think>The final answer.";
    for (const size of [1, 2, 3, 5, 7, 11]) {
      const { text, reasoning } = run(chunked(source, size));
      expect(reasoning).toBe("deliberating here");
      expect(text).toBe("The final answer.");
    }
  });

  it("recognises <reasoning> spans too", () => {
    const { text, reasoning } = run(["<reasoning>weighing</reasoning>Done."]);

    expect(reasoning).toBe("weighing");
    expect(text).toBe("Done.");
  });

  it("treats an unterminated <think> span as reasoning to the end", () => {
    const { text, reasoning } = run(["<think>still thinking when cut off"]);

    expect(reasoning).toBe("still thinking when cut off");
    expect(text).toBe("");
  });

  it("emits a near-miss tail as ordinary text rather than swallowing it", () => {
    const { text, reasoning } = run(["Compare a < b and c <th"]);

    expect(text).toBe("Compare a < b and c <th");
    expect(reasoning).toBe("");
  });

  it("leaves a response with no markers untouched", () => {
    const { text, reasoning } = run(["Plain answer, ", "no markers at all."]);

    expect(text).toBe("Plain answer, no markers at all.");
    expect(reasoning).toBe("");
  });
});

describe("InlineReasoningSplitter — gpt-oss harmony channels", () => {
  it("keeps the analysis channel out of the answer", () => {
    const { text, reasoning } = run([
      "<|channel|>analysis<|message|>We need to produce a paragraph about coffee, purely in Markdown.",
      "<|end|><|start|>assistant<|channel|>final<|message|>Coffee is a beloved beverage.",
    ]);

    expect(reasoning).toBe(
      "We need to produce a paragraph about coffee, purely in Markdown."
    );
    expect(text).toBe("Coffee is a beloved beverage.");
  });

  it("treats the commentary channel as thinking", () => {
    const { text, reasoning } = run([
      "<|channel|>commentary<|message|>calling a tool<|end|>",
      "<|channel|>final<|message|>Result.",
    ]);

    expect(reasoning).toBe("calling a tool");
    expect(text).toBe("Result.");
  });

  it("survives any chunk framing of a harmony response", () => {
    const source =
      "<|channel|>analysis<|message|>thinking it through<|end|>" +
      "<|start|>assistant<|channel|>final<|message|>Answer text.";
    for (const size of [1, 2, 4, 9, 13]) {
      const { text, reasoning } = run(chunked(source, size));
      expect(reasoning).toBe("thinking it through");
      expect(text).toBe("Answer text.");
    }
  });

  it("does not leak the channel header into either half", () => {
    const { text, reasoning } = run([
      "<|channel|>final<|message|>Just the answer.",
    ]);

    expect(text).toBe("Just the answer.");
    expect(reasoning).toBe("");
  });
});

describe("stripInlineReasoning", () => {
  it("removes a think span from a one-shot response", () => {
    expect(stripInlineReasoning("<think>pondering</think>Coffee Notes")).toBe(
      "Coffee Notes"
    );
  });

  it("removes a harmony analysis channel from a one-shot response", () => {
    expect(
      stripInlineReasoning(
        "<|channel|>analysis<|message|>naming it<|end|><|channel|>final<|message|>Coffee Notes"
      )
    ).toBe("Coffee Notes");
  });

  it("passes clean content through unchanged", () => {
    expect(stripInlineReasoning("Coffee Notes")).toBe("Coffee Notes");
  });

  it("returns an empty string unchanged", () => {
    expect(stripInlineReasoning("")).toBe("");
  });
});
