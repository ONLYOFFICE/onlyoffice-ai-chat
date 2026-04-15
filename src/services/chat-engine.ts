import type {
  FileMessagePart,
  ImageMessagePart,
  ThreadMessageLike,
} from "@assistant-ui/react";
import type { AppContext } from "../app-context";
import type { SendMessageReturnType } from "../providers";
import type { TAttachmentFile, TAttachmentImage } from "../types";

// --- Event types ---

/**
 * Discriminated union of events emitted by {@link ChatEngine} during message
 * processing. Consumers iterate an `AsyncGenerator<ChatEvent>` and react to
 * each variant:
 *
 * - `message-start` -- first streaming chunk of an assistant reply.
 * - `message-delta` -- subsequent streaming chunk or tool-result update.
 * - `message-end` -- assistant reply finished successfully.
 * - `message-incomplete` -- provider returned an incomplete / error status.
 * - `tool-call-pending` -- a tool call requires user approval before execution.
 * - `thread-title` -- auto-generated title ready for a new thread.
 */
export type ChatEvent =
  | { type: "message-start"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-delta"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-end"; message: ThreadMessageLike; messageUID: string }
  | { type: "message-incomplete"; message: ThreadMessageLike }
  | {
      type: "tool-call-pending";
      message: ThreadMessageLike;
      idx: number;
      messageUID: string;
    }
  | {
      type: "thread-title";
      title: string;
      profileId?: string;
    };

/**
 * Data required to identify a pending tool call within an assistant message.
 *
 * @property message - The full assistant message containing the tool call.
 * @property idx - Index of the tool-call content part inside `message.content`.
 * @property messageUID - Unique identifier of the message in storage.
 */
export type ToolCallData = {
  message: ThreadMessageLike;
  idx: number;
  messageUID: string;
};

// --- ChatEngine ---

/**
 * Orchestrates the full message lifecycle: sending user messages to the AI
 * provider, streaming assistant responses, handling tool-call approval /
 * denial, persisting messages to storage, and generating thread titles.
 *
 * All public methods are async generators that yield {@link ChatEvent}
 * instances, allowing the UI layer to react incrementally as data arrives.
 *
 * Middleware hooks (`beforeToolCall`, `afterToolResult`, `onStreamChunk`,
 * `onError`) are invoked at the appropriate points in the pipeline.
 */
export class ChatEngine {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /**
   * Send a user message to the current AI provider and stream back the
   * assistant response.
   *
   * For new threads (no existing storage entry) the method also persists all
   * prior messages, initiates asynchronous title generation, and yields a
   * `thread-title` event once the title is ready.
   *
   * @param params - Message payload and thread context.
   * @param params.text - The user's text input.
   * @param params.threadId - Target thread identifier.
   * @param params.files - Optional file attachments.
   * @param params.images - Optional image attachments.
   * @param params.existingMessages - Messages already present in the thread.
   * @param params.extendedThinking - Whether extended thinking mode is enabled.
   * @param params.profileId - Optional profile that originated the request.
   * @returns An async generator of {@link ChatEvent} instances.
   */
  async *sendMessage(params: {
    text: string;
    threadId: string;
    files?: TAttachmentFile[];
    images?: TAttachmentImage[];
    existingMessages: ThreadMessageLike[];
    extendedThinking: boolean;
    profileId?: string;
  }): AsyncGenerator<ChatEvent> {
    const fileContent: FileMessagePart[] = (params.files ?? []).map((file) => ({
      type: "file",
      mimeType: JSON.stringify({ path: file.path, type: file.type }),
      data: file.content,
    }));

    const imageContent: ImageMessagePart[] = (params.images ?? []).map(
      (image) => ({
        type: "image",
        image: image.base64,
        name: image.name,
      })
    );

    const content: ThreadMessageLike["content"] = [
      ...fileContent,
      ...imageContent,
      { type: "text", text: params.text },
    ];

    const userMessage: ThreadMessageLike = {
      role: "user",
      content,
    };

    const storage = this.ctx.storage;
    const existingThread = await storage.threads.getById(params.threadId);

    if (!existingThread) {
      let textForTitle = "";
      for (const msg of params.existingMessages) {
        if (msg.status?.type === "incomplete" && msg.status?.error) continue;
        textForTitle +=
          typeof msg.content === "string"
            ? msg.content
            : msg.content[0].type === "text"
              ? msg.content[0].text
              : "";
        textForTitle += "\n\n";
      }
      textForTitle += `\n\n${params.text}`;

      for (const msg of params.existingMessages) {
        if (msg.status?.type === "incomplete" && msg.status?.error) continue;
        await storage.messages.create(
          params.threadId,
          crypto.randomUUID(),
          msg
        );
      }

      await storage.messages.create(
        params.threadId,
        crypto.randomUUID(),
        userMessage
      );

      this._pendingTitlePromises.set(
        params.threadId,
        this.ctx.provider.createChatName(textForTitle).then((title) => {
          if (!title) return null;
          return { title, profileId: params.profileId };
        })
      );
    } else {
      storage.threads.touch(params.threadId, {
        ...(params.profileId !== undefined
          ? { profileId: params.profileId }
          : {}),
      });
      storage.messages.create(
        params.threadId,
        crypto.randomUUID(),
        userMessage
      );
    }

    const stream = this.ctx.provider.sendMessage(
      [userMessage],
      params.extendedThinking
    );

    yield* this._processStream(stream, params.threadId, false);

    // Await title generation and yield if ready
    const pendingTitle = this._pendingTitlePromises.get(params.threadId);
    if (pendingTitle) {
      this._pendingTitlePromises.delete(params.threadId);
      const titleResult = await pendingTitle;
      if (titleResult) {
        yield {
          type: "thread-title" as const,
          title: titleResult.title,
          profileId: titleResult.profileId,
        };
      }
    }
  }

  /**
   * Approve a pending tool call, execute it, and continue the conversation
   * with the tool result fed back to the provider.
   *
   * @param data - The pending tool call data (message, index, UID).
   * @param allowAlways - When `true`, marks this tool as auto-approved for
   *   future invocations in the current session.
   * @param extendedThinking - Whether extended thinking mode is enabled.
   * @returns An async generator of {@link ChatEvent} instances.
   */
  async *approveToolCall(
    data: ToolCallData,
    allowAlways: boolean,
    extendedThinking: boolean
  ): AsyncGenerator<ChatEvent> {
    const toolCall = data.message.content[data.idx];
    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const toolName = toolCall.toolName;
    const type = this.ctx.servers.getServerType(toolName);
    const name = toolName.replace(`${type}_`, "");

    if (allowAlways) {
      this.ctx.servers.setAllowAlways(true, type, name);
    }

    yield* this._executeToolCall(
      data.message,
      data.idx,
      data.messageUID,
      extendedThinking,
      false
    );
  }

  /**
   * Deny a pending tool call, sending a "User deny tool call" result back to
   * the provider so it can continue the conversation without the tool output.
   *
   * @param data - The pending tool call data (message, index, UID).
   * @param extendedThinking - Whether extended thinking mode is enabled.
   * @returns An async generator of {@link ChatEvent} instances.
   */
  async *denyToolCall(
    data: ToolCallData,
    extendedThinking: boolean
  ): AsyncGenerator<ChatEvent> {
    yield* this._executeToolCall(
      data.message,
      data.idx,
      data.messageUID,
      extendedThinking,
      true
    );
  }

  /**
   * Immediately abort the in-flight provider stream, cancelling any ongoing
   * message generation.
   */
  stop(): void {
    this.ctx.provider.stopMessage();
  }

  // --- Internal ---

  private _pendingTitlePromises = new Map<
    string,
    Promise<{ title: string; profileId?: string } | null>
  >();

  async *handleToolCall(
    msg: ThreadMessageLike,
    idx: number,
    messageUID: string,
    extendedThinking: boolean,
    threadId?: string
  ): AsyncGenerator<ChatEvent> {
    const toolCall = msg.content[idx];
    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    const toolName = toolCall.toolName;
    const type = this.ctx.servers.getServerType(toolName);
    const name = toolName.replace(`${type}_`, "");

    // Run beforeToolCall middleware
    const runner = this.ctx.middlewareRunner;
    if (!runner.isEmpty) {
      const mwResult = await runner.runBeforeToolCall({
        toolName,
        toolArgs: (toolCall.args ?? {}) as Record<string, unknown>,
        toolSource: type,
        threadId: threadId ?? "",
        messageUID,
      });
      if (mwResult.action === "approve") {
        yield* this._executeToolCall(
          msg,
          idx,
          messageUID,
          extendedThinking,
          false
        );
        return;
      }
      if (mwResult.action === "deny") {
        yield* this._executeToolCall(
          msg,
          idx,
          messageUID,
          extendedThinking,
          true
        );
        return;
      }
      // "continue" — apply modified args if any
      if (mwResult.action === "continue" && mwResult.args) {
        const updatedContent = Array.isArray(msg.content)
          ? msg.content.map((item, index) =>
              index === idx ? { ...toolCall, args: mwResult.args } : item
            )
          : msg.content;
        msg = { ...msg, content: updatedContent };
      }
    }

    if (this.ctx.servers.checkAllowAlways(type, name)) {
      yield* this._executeToolCall(
        msg,
        idx,
        messageUID,
        extendedThinking,
        false
      );
    } else {
      yield {
        type: "tool-call-pending" as const,
        message: msg,
        idx,
        messageUID,
      };
    }
  }

  private async *_executeToolCall(
    msg: ThreadMessageLike,
    idx: number,
    messageUID: string,
    extendedThinking: boolean,
    deny: boolean
  ): AsyncGenerator<ChatEvent> {
    const toolCall = msg.content[idx];
    if (
      !toolCall ||
      typeof toolCall !== "object" ||
      !("type" in toolCall) ||
      toolCall.type !== "tool-call"
    )
      return;

    let result: unknown = deny
      ? "User deny tool call"
      : await this.ctx.servers.callTools(
          this.ctx.servers.getServerType(toolCall.toolName),
          toolCall.toolName.replace(
            `${this.ctx.servers.getServerType(toolCall.toolName)}_`,
            ""
          ),
          toolCall.args as Record<string, unknown>
        );

    // Run afterToolResult middleware
    if (!deny && !this.ctx.middlewareRunner.isEmpty) {
      const mwResult = await this.ctx.middlewareRunner.runAfterToolResult({
        toolName: toolCall.toolName,
        toolArgs: (toolCall.args ?? {}) as Record<string, unknown>,
        result,
        threadId: "",
      });
      if (mwResult.action === "skip") return;
      if (mwResult.action === "continue" && mwResult.result !== undefined) {
        result = mwResult.result;
      }
    }

    if (!deny) {
      this.ctx.callbacksManager.emit("onToolCallResult", {
        threadId: "",
        toolName: toolCall.toolName,
        result,
      });
    }

    const updatedContent = Array.isArray(msg.content)
      ? msg.content.map((item, index) =>
          index === idx ? { ...toolCall, result } : item
        )
      : msg.content;

    const updatedMessage = { ...msg, content: updatedContent };

    yield {
      type: "message-delta" as const,
      message: updatedMessage,
      messageUID,
    };
    this.ctx.storage.messages.update(messageUID, updatedMessage);

    const streamAfterToolCall = this.ctx.provider.sendMessageAfterToolCall(
      updatedMessage,
      extendedThinking
    );

    yield* this._processStream(streamAfterToolCall, "", true, messageUID);
  }

  private async *_processStream(
    stream: SendMessageReturnType,
    threadId: string,
    afterToolCall: boolean,
    messageUIDProp?: string
  ): AsyncGenerator<ChatEvent> {
    let initedMessage = afterToolCall;
    const messageUID =
      afterToolCall && messageUIDProp ? messageUIDProp : crypto.randomUUID();
    const runner = this.ctx.middlewareRunner;

    for await (const message of stream) {
      if ("isEnd" in message) {
        if (message.responseMessage.status?.type === "incomplete") {
          // Run onError middleware for incomplete messages
          if (!runner.isEmpty) {
            const errorResult = await runner.runOnError({
              error: message.responseMessage.status.error,
              type: "provider",
              threadId,
              messageUID,
            });
            if (errorResult.action === "suppress") return;
            // retry and fallback are handled by the caller
          }

          yield {
            type: "message-incomplete" as const,
            message: message.responseMessage,
          };
          return;
        }

        const lastMessage = message.responseMessage;

        if (
          lastMessage?.role === "assistant" &&
          Array.isArray(lastMessage.content)
        ) {
          const toolCallIdx = lastMessage.content.findIndex(
            (c) => c.type === "tool-call" && !c.result
          );

          if (toolCallIdx !== -1) {
            yield {
              type: "tool-call-pending" as const,
              message: lastMessage,
              idx: toolCallIdx,
              messageUID,
            };
            return;
          }
        }

        yield {
          type: "message-end" as const,
          message: message.responseMessage,
          messageUID,
        };
        return;
      }

      // Run onStreamChunk middleware
      let chunk = message;
      if (!runner.isEmpty) {
        const chunkResult = await runner.runOnStreamChunk({
          chunk: message,
          threadId,
          messageUID,
          isFirst: !initedMessage,
        });
        if (chunkResult.action === "skip") continue;
        if (chunkResult.action === "continue" && chunkResult.chunk) {
          chunk = chunkResult.chunk;
        }
      }

      if (!initedMessage) {
        yield {
          type: "message-start" as const,
          message: chunk,
          messageUID,
        };
        if (!afterToolCall) {
          this.ctx.storage.messages.create(threadId, messageUID, chunk);
        }
        initedMessage = true;
      } else {
        this.ctx.storage.messages.update(messageUID, chunk);
        yield {
          type: "message-delta" as const,
          message: chunk,
          messageUID,
        };
      }
    }
  }
}
