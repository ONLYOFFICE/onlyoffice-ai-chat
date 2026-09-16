/**
 * Whether a reasoning part's `parentId` is a signature Anthropic issued.
 *
 * The Anthropic stream stashes the `signature_delta` of a thinking block
 * on the part's `parentId`; it is a long base64 string. Reasoning captured
 * from other providers carries either no `parentId` or the synthetic
 * `reasoning-<time>-<random>` id the OpenAI stream assigns when it
 * finalizes a block — the dash alone puts it outside base64. Only the
 * former can be replayed as a `thinking` block, so this is the gate.
 *
 * @param parentId - The reasoning part's `parentId`, if any.
 * @returns `true` when the value can be sent back as a thinking signature.
 */
export const isThinkingSignature = (
  parentId: string | undefined
): parentId is string =>
  typeof parentId === "string" &&
  parentId.length >= 32 &&
  /^[A-Za-z0-9+/]+=*$/.test(parentId);
