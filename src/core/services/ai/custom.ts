import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { custom, customSync } from "../../actions/custom";
import type { CustomArgs } from "../../actions/custom";
import type { AssignmentsEngine } from "../assignments";
import type { SendCustomInput } from "./types";

/**
 * Resolve the `Default` profile via the supplied
 * {@link AssignmentsEngine} and produce {@link CustomArgs} for the
 * custom-prompt action. Shared between streaming and one-shot paths.
 */
async function buildArgs(
  assignments: AssignmentsEngine,
  input: SendCustomInput
): Promise<CustomArgs> {
  const { profile } = await assignments.resolveForAction(ActionType.Default);
  return {
    ...input.actionArgs,
    profile,
    messages: [input.userMessage],
    systemPrompt: input.systemPrompt,
  };
}

/** Streaming custom-prompt path. Yields raw `SendMessageResult` events. */
export async function* runCustomStream(
  assignments: AssignmentsEngine,
  input: SendCustomInput
): AsyncGenerator<SendMessageResult> {
  const args = await buildArgs(assignments, input);
  yield* custom(args);
}

/** One-shot custom-prompt path. Awaits a single response message. */
export async function runCustomOnce(
  assignments: AssignmentsEngine,
  input: SendCustomInput
): Promise<ThreadMessageLike> {
  const args = await buildArgs(assignments, input);
  return customSync(args);
}
