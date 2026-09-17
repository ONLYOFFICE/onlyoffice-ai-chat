import { describe, expect, it } from "vitest";
import { sanitizeGeminiSchema } from "../schema";
import { convertTools } from "../tools";

describe("genai/schema/sanitizeGeminiSchema", () => {
  it("drops a numeric enum from an integer property and lists the values in the description", () => {
    // The editor's tool that took Gemini down (Bug 83699).
    const out = sanitizeGeminiSchema({
      type: "object",
      properties: {
        text: { type: "string" },
        level: { type: "integer", description: "Heading level", enum: [2, 3] },
      },
      required: ["level"],
    });
    expect(out).toEqual({
      type: "object",
      properties: {
        text: { type: "string" },
        level: {
          type: "integer",
          description: "Heading level Allowed values: 2, 3.",
        },
      },
      required: ["level"],
    });
  });

  it("writes the note alone when the property had no description", () => {
    const out = sanitizeGeminiSchema({
      properties: { mode: { type: "number", enum: [0.5, 1] } },
    });
    expect(out.properties).toEqual({
      mode: { type: "number", description: "Allowed values: 0.5, 1." },
    });
  });

  it("stringifies the members of a string (or untyped) enum", () => {
    const out = sanitizeGeminiSchema({
      properties: {
        a: { type: "string", enum: ["x", 1, true] },
        b: { enum: ["y", 2] },
      },
    });
    expect(out.properties).toEqual({
      a: { type: "string", enum: ["x", "1", "true"] },
      b: { enum: ["y", "2"] },
    });
  });

  it("removes keys outside Gemini's Schema and keeps the supported ones", () => {
    const out = sanitizeGeminiSchema({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      title: "Args",
      description: "d",
      properties: {
        q: {
          type: "string",
          const: "fixed",
          examples: ["a"],
          minLength: 1,
          pattern: "^.+$",
        },
      },
      required: ["q"],
      oneOf: [{ required: ["q"] }],
    });
    expect(out).toEqual({
      type: "object",
      title: "Args",
      description: "d",
      properties: { q: { type: "string", minLength: 1, pattern: "^.+$" } },
      required: ["q"],
    });
  });

  it("turns a union type into a single type plus nullable", () => {
    expect(sanitizeGeminiSchema({ type: ["string", "null"] })).toEqual({
      type: "string",
      nullable: true,
    });
    expect(sanitizeGeminiSchema({ type: ["null"] })).toEqual({
      nullable: true,
    });
  });

  it("drops a format Gemini does not document", () => {
    expect(
      sanitizeGeminiSchema({
        properties: {
          when: { type: "string", format: "date-time" },
          link: { type: "string", format: "uri" },
        },
      })
    ).toEqual({
      properties: {
        when: { type: "string", format: "date-time" },
        link: { type: "string" },
      },
    });
  });

  it("recurses into items and anyOf", () => {
    expect(
      sanitizeGeminiSchema({
        type: "array",
        items: { type: "integer", enum: [1, 2], $comment: "x" },
        anyOf: [{ type: "string", const: "a" }],
      })
    ).toEqual({
      type: "array",
      items: { type: "integer", description: "Allowed values: 1, 2." },
      anyOf: [{ type: "string" }],
    });
  });

  it("never mutates the input", () => {
    const input = {
      properties: { n: { type: "integer", enum: [1] } },
      additionalProperties: false,
    };
    const copy = JSON.parse(JSON.stringify(input));
    void sanitizeGeminiSchema(input);
    expect(input).toEqual(copy);
  });

  it("yields an empty schema for a missing or malformed input", () => {
    expect(sanitizeGeminiSchema(undefined)).toEqual({});
    expect(sanitizeGeminiSchema("nope")).toEqual({});
  });
});

describe("genai/tools/convertTools — sanitized parameters", () => {
  it("sends the sanitized schema under the OBJECT root", () => {
    const out = convertTools([
      {
        name: "set_heading",
        description: "Set heading",
        inputSchema: {
          $schema: "x",
          properties: { level: { type: "integer", enum: [2, 3] } },
        },
      },
    ]);
    expect(out[0].parameters).toEqual({
      type: "OBJECT",
      properties: {
        level: { type: "integer", description: "Allowed values: 2, 3." },
      },
    });
  });
});
