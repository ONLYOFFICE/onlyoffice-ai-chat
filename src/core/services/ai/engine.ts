import type { ThreadMessageLike } from "@assistant-ui/react";
import { ActionType } from "../../../shared/action-type";
import type { SendMessageResult } from "../../../shared/send-message-args";
import { chat } from "../../actions/chat";
import type { ActionArgs } from "../../actions/types";
import { AssignmentsEngine } from "../assignments";
import { ThreadsEngine } from "../threads";
import { drainToFinal, runSync } from "./actions";
import { runCustomOnce, runCustomStream } from "./custom";
import { persistTerminal } from "./stream";
import type {
  AIEngineDeps,
  SendCustomInput,
  SendInput,
  SendResult,
  SendStreamInput,
} from "./types";

/**
 * Thin orchestrator that binds the AI actions layer to a
 * {@link StorageAdapter} via the {@link AssignmentsEngine} and
 * {@link ThreadsEngine} sub-engines.
 *
 * - {@link sendWithStream} — `Chat` only. Full thread lifecycle: load
 *   or create thread, persist user message + assistant reply, stream
 *   the action's deltas.
 * - {@link send} — any `ActionType`. One-shot: resolve the profile,
 *   invoke the action on a single message, return the response. No
 *   thread, no history, no persistence.
 * - {@link sendCustom} — free-form one-turn call with a caller-supplied
 *   system prompt against the `Default` profile. Mode (stream vs
 *   one-shot) chosen at call time via `isStream`.
 */
export class AIEngine {
  private readonly deps: AIEngineDeps;
  private readonly assignments: AssignmentsEngine;
  private readonly threads: ThreadsEngine;

  constructor(deps: AIEngineDeps) {
    this.deps = deps;
    this.assignments =
      deps.assignments ?? new AssignmentsEngine({ storage: deps.storage });
    this.threads =
      deps.threads ?? new ThreadsEngine({ storage: deps.storage });
  }

  async *sendWithStream(input: SendStreamInput): AsyncGenerator<SendResult> {
    const { profileId, profile } = await this.assignments.resolveForAction(
      ActionType.Chat
    );
    const { threadId, title, priorMessages } = await this.threads.openOrCreate({
      threadId: input.threadId,
      profile,
      profileId,
      firstMessage: input.userMessage,
    });
    await this.threads.appendUserMessage(threadId, input.userMessage, profileId);

    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: [...priorMessages, input.userMessage],
    };

    for await (const result of chat(actionArgs)) {
      await persistTerminal(this.deps.storage, threadId, result);
      yield { threadId, title, result };
    }
  }

  async send(input: SendInput): Promise<ThreadMessageLike> {
    const { profile } = await this.assignments.resolveForAction(
      input.actionType
    );
    const actionArgs: ActionArgs = {
      ...input.actionArgs,
      profile,
      messages: [input.userMessage],
    };

    return input.actionType === ActionType.Chat
      ? drainToFinal(chat(actionArgs))
      : runSync(input.actionType, actionArgs);
  }

  sendCustom(
    input: SendCustomInput
  ): AsyncGenerator<SendMessageResult> | Promise<ThreadMessageLike> {
    return input.isStream
      ? runCustomStream(this.assignments, input)
      : runCustomOnce(this.assignments, input);
  }
}
