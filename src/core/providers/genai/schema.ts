/**
 * The subset of JSON Schema Gemini's `Schema` accepts — every key of the
 * SDK's `Schema` interface (`@google/genai` 1.50). Anything else in a tool's
 * `inputSchema` is rejected upstream with `400 INVALID_ARGUMENT: Unknown
 * name`, so the sanitizer keeps only these.
 */
const GEMINI_SCHEMA_KEYS = new Set([
  "anyOf",
  "default",
  "description",
  "enum",
  "example",
  "format",
  "items",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "nullable",
  "pattern",
  "properties",
  "propertyOrdering",
  "required",
  "title",
  "type",
]);

/**
 * `format` values Gemini documents per type. Others (`uri`, `email`,
 * `date`, …) are common in MCP schemas and fail the same way an unknown
 * key does, so they are dropped rather than forwarded.
 */
const GEMINI_FORMATS = new Set([
  "enum",
  "date-time",
  "int32",
  "int64",
  "float",
  "double",
]);

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Resolve a JSON Schema `type`, which may be a union array
 * (`["string", "null"]`), into Gemini's single `type` + `nullable` flag.
 */
const resolveType = (type: unknown): { type?: string; nullable?: boolean } => {
  if (typeof type === "string") return { type };
  if (!Array.isArray(type)) return {};
  const names = type.filter((t): t is string => typeof t === "string");
  const concrete = names.find((t) => t !== "null");
  return {
    ...(concrete ? { type: concrete } : {}),
    ...(names.includes("null") ? { nullable: true } : {}),
  };
};

/**
 * Rewrite an `enum` for Gemini, which accepts string members only — a
 * numeric `enum: [2, 3]` fails with `Invalid value at …enum[0]
 * (TYPE_STRING)` (Bug 83699), and because tools go out with every request
 * that breaks the whole provider, not one call.
 *
 * A string property keeps its enum with every member stringified. Any
 * other type loses the enum and gets the allowed values appended to the
 * description instead: the model still learns the choices, and the host
 * still receives `2`, not `"2"`.
 */
const rewriteEnum = (
  schema: JsonObject,
  values: unknown[],
  type: string | undefined
): void => {
  const rendered = values.map((v) =>
    typeof v === "string" ? v : JSON.stringify(v)
  );
  if (type === undefined || type === "string") {
    schema.enum = rendered;
    return;
  }
  delete schema.enum;
  const note = `Allowed values: ${rendered.join(", ")}.`;
  const description =
    typeof schema.description === "string" ? schema.description.trim() : "";
  schema.description = description ? `${description} ${note}` : note;
};

/**
 * Reduce a tool's JSON Schema to what Gemini's function-declaration
 * `parameters` accepts. Tool schemas come from hosts (the editor's tool
 * catalogue, MCP servers) that write for the wider JSON Schema OpenAI and
 * Anthropic take, so the provider has to translate rather than forward:
 *
 * - unknown keys (`$schema`, `additionalProperties`, `const`, `oneOf`,
 *   `examples`, …) are dropped;
 * - a union `type` becomes a single type plus `nullable`;
 * - a `format` Gemini does not document is dropped;
 * - a non-string `enum` is rewritten — see {@link rewriteEnum};
 * - `properties`, `items` and `anyOf` are sanitized recursively.
 *
 * The input is never mutated.
 *
 * @param schema - A JSON Schema fragment, usually a tool's `inputSchema`.
 * @returns A fresh object Gemini accepts; a non-object input yields `{}`.
 */
export const sanitizeGeminiSchema = (schema: unknown): JsonObject => {
  if (!isObject(schema)) return {};

  const out: JsonObject = {};
  for (const [key, value] of Object.entries(schema)) {
    if (GEMINI_SCHEMA_KEYS.has(key)) out[key] = value;
  }

  const { type, nullable } = resolveType(out.type);
  if (type) out.type = type;
  else delete out.type;
  if (nullable) out.nullable = true;

  if (typeof out.format === "string" && !GEMINI_FORMATS.has(out.format)) {
    delete out.format;
  }

  if (Array.isArray(out.enum)) {
    rewriteEnum(out, out.enum, type);
  }

  if (isObject(out.properties)) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([name, prop]) => [
        name,
        sanitizeGeminiSchema(prop),
      ])
    );
  }

  if (isObject(out.items)) {
    out.items = sanitizeGeminiSchema(out.items);
  }

  if (Array.isArray(out.anyOf)) {
    out.anyOf = out.anyOf.map(sanitizeGeminiSchema);
  }

  return out;
};
