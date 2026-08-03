import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ProviderFetch } from "../../../shared/provider-credentials";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { resolveAttachmentRefs } from "../../actions/attachment-resolution";
import { custom, customSync } from "../../actions/custom";
import type { CustomArgs } from "../../actions/custom";
import type { AttachmentsStorage } from "../../storage";
import type { ResolvedAssignment } from "../assignments/types";
import type { SendCustomInput } from "./types";

/**
 * Picks the custom fetch (if any) for the resolved profile. Owned by
 * the engine so the same `external`/`useProxy` logic is applied to
 * the custom-prompt path.
 */
export type PickFetch = (profile: {
  providerType?: string;
  useProxy?: boolean;
}) => ProviderFetch | undefined;

/**
 * Resolves the profile the custom call runs against. Supplied by the
 * engine so the same "explicit `profileId` wins, else `Default`" logic
 * used by the chat path applies here too (see
 * `AIEngine.resolveCustomProfile`).
 */
export type ResolveProfile = () => Promise<ResolvedAssignment>;

/**
 * Resolve the target profile via the supplied {@link ResolveProfile}
 * and produce {@link CustomArgs} for the custom-prompt action. Shared
 * between streaming and one-shot paths.
 */
async function buildArgs(
  resolveProfile: ResolveProfile,
  input: SendCustomInput,
  pickFetch: PickFetch,
  attachments: AttachmentsStorage
): Promise<CustomArgs> {
  const { profile } = await resolveProfile();
  return {
    ...input.actionArgs,
    profile,
    // Hydrate image/file refs into inline data before the provider sees
    // them — a custom/arbiter flow with an image attachment must ship
    // base64, not the raw ref or a host URL.
    messages: await resolveAttachmentRefs([input.userMessage], attachments),
    systemPrompt: input.systemPrompt,
    fetch: pickFetch(profile),
  };
}

/** Streaming custom-prompt path. Yields raw `SendMessageResult` events. */
export async function* runCustomStream(
  resolveProfile: ResolveProfile,
  input: SendCustomInput,
  pickFetch: PickFetch,
  attachments: AttachmentsStorage
): AsyncGenerator<SendMessageResult> {
  const args = await buildArgs(resolveProfile, input, pickFetch, attachments);
  yield* custom(args);
}

/** One-shot custom-prompt path. Awaits a single response message. */
export async function runCustomOnce(
  resolveProfile: ResolveProfile,
  input: SendCustomInput,
  pickFetch: PickFetch,
  attachments: AttachmentsStorage
): Promise<ThreadMessageLike> {
  const args = await buildArgs(resolveProfile, input, pickFetch, attachments);
  return customSync(args);
}
