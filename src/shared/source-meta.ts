/**
 * The host entry a billable request is attributed to, as the ONLYOFFICE
 * backend classifies it: a DocSpace agent, room, form, folder or file.
 * Every provider request the ONLYOFFICE provider builds and every built-in
 * web-search request against the ONLYOFFICE gateway carries it as the
 * request's `metadata` object (`source_id` / `source_type` /
 * `source_title`), so usage can be billed to the right entry.
 *
 * Supplied by the host: a server-side engine resolves it from the round's
 * scope through the engines' `resolveSource` dep (see {@link SourceResolver});
 * a caller driving `AIEngine` directly may pass it in `actionArgs.source`.
 * Every other provider ignores it, so the value never reaches a third-party
 * endpoint.
 */
export type SourceMeta = {
  /** Identifier of the entry (the DocSpace folder or file id). */
  id: string;
  /**
   * Classification the billing backend understands — `"Agent"`, `"Room"`,
   * `"Form"`, `"Folder"`, `"File"`. Left to the host; the library forwards
   * it verbatim and omits the key when absent.
   */
  type?: string;
  /** Human-readable title of the entry. Omitted from the wire when absent. */
  title?: string;
};

/** Wire keys of the `metadata` object the ONLYOFFICE billing backend reads. */
export const SOURCE_METADATA_KEYS = {
  id: "source_id",
  type: "source_type",
  title: "source_title",
} as const;

/**
 * The `metadata` fields for a resolved source, or `undefined` when there is
 * none — callers drop the whole object rather than sending empty values.
 * Only the keys with a value are present.
 */
export function sourceMetadataFields(
  source: SourceMeta | undefined
): Record<string, string> | undefined {
  if (!source?.id) return undefined;
  const fields: Record<string, string> = {
    [SOURCE_METADATA_KEYS.id]: source.id,
  };
  if (source.type) fields[SOURCE_METADATA_KEYS.type] = source.type;
  if (source.title) fields[SOURCE_METADATA_KEYS.title] = source.title;
  return fields;
}

/** What the engine knows about a round when it asks the host for its source. */
export type SourceScope = {
  /**
   * The host entry the round runs for. On the scoped entry points (`send`,
   * `sendWithStream`, `regenerateStream`, tool-call approve / deny,
   * `openOrCreate`) this is the input's context scope, `contextEntityId ??
   * entityId`. The scope-less paths (`sendCustom`, `regenerateTitle`) have
   * no such input and pass the caller's `actionArgs.entityId` /
   * `entityMeta.entityId` hint instead — the same host entry, named by the
   * caller rather than by the round.
   */
  entityId?: string;
  /** The thread the round runs in, when it already exists. */
  threadId?: string;
};

/**
 * Host hook that names the entry a round is billed to. Called once per
 * engine entry point (send, stream, regenerate, tool-call resume, title
 * generation) before any provider request; the answer travels into every
 * request of that round. When the hook is wired its answer is final — a
 * caller-supplied `actionArgs.source` is ignored, so a client cannot claim
 * an entry the host did not resolve. Return `undefined` to send no source.
 */
export type SourceResolver = (
  scope: SourceScope
) => SourceMeta | undefined | Promise<SourceMeta | undefined>;
