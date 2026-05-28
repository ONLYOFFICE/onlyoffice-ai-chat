import type {
  AfterToolResultContext,
  AfterToolResultResult,
  BeforeDisplayContext,
  BeforeDisplayResult,
  BeforeSendContext,
  BeforeSendResult,
  BeforeToolCallContext,
  BeforeToolCallResult,
  ChatMiddleware,
  ErrorContext,
  ErrorResult,
  StreamChunkContext,
  StreamChunkResult,
} from "./types";

/**
 * Executes a chain of {@link ChatMiddleware} instances sequentially.
 *
 * Each middleware receives the (possibly modified) context produced by the
 * previous middleware in the chain. A blocking action (`"block"`, `"deny"`,
 * `"skip"`, `"suppress"`, or `"approve"`) short-circuits the chain and
 * returns immediately.
 *
 * @example
 * ```ts
 * const runner = new MiddlewareRunner([loggingMiddleware, contentFilter]);
 *
 * const result = await runner.runBeforeSend({
 *   text: "Hello",
 *   files: [],
 *   images: [],
 *   threadId: "t1",
 *   profile: null,
 *   existingMessages: [],
 * });
 *
 * if (result.action === "block") {
 *   console.warn("Blocked:", result.reason);
 * }
 * ```
 */
export class MiddlewareRunner {
  private middlewares: ChatMiddleware[];

  /**
   * Create a new runner with an ordered list of middlewares.
   *
   * @param middlewares - Middlewares to execute, in order. Earlier entries run first.
   */
  constructor(middlewares: ChatMiddleware[]) {
    this.middlewares = middlewares;
  }

  /** `true` when there are no registered middlewares, useful for skipping the async call entirely. */
  get isEmpty(): boolean {
    return this.middlewares.length === 0;
  }

  /**
   * Run the `beforeSend` hook chain.
   *
   * Walks through each middleware's `beforeSend` handler. If any handler
   * returns `{ action: "block" }`, the chain stops and the block result is
   * returned. Otherwise, field overrides (`text`, `files`, `images`) are
   * merged into the context for subsequent middlewares.
   *
   * @param ctx - The outgoing message context.
   * @returns The final result after all middlewares have run.
   */
  async runBeforeSend(ctx: BeforeSendContext): Promise<BeforeSendResult> {
    let currentCtx = { ...ctx };
    for (const mw of this.middlewares) {
      if (!mw.beforeSend) continue;
      const result = await mw.beforeSend(currentCtx);
      if (result.action === "block") return result;
      if (result.action === "continue") {
        currentCtx = {
          ...currentCtx,
          ...(result.text !== undefined ? { text: result.text } : {}),
          ...(result.files !== undefined ? { files: result.files } : {}),
          ...(result.images !== undefined ? { images: result.images } : {}),
        };
      }
    }
    return {
      action: "continue",
      text: currentCtx.text,
      files: currentCtx.files,
      images: currentCtx.images,
    };
  }

  /**
   * Run the `onStreamChunk` hook chain.
   *
   * Each middleware may replace the chunk or return `{ action: "skip" }` to
   * drop it. Skipping short-circuits the chain.
   *
   * @param ctx - The stream chunk context.
   * @returns The final result — either a (possibly modified) chunk or a skip directive.
   */
  async runOnStreamChunk(ctx: StreamChunkContext): Promise<StreamChunkResult> {
    let currentCtx = { ...ctx };
    for (const mw of this.middlewares) {
      if (!mw.onStreamChunk) continue;
      const result = await mw.onStreamChunk(currentCtx);
      if (result.action === "skip") return result;
      if (result.action === "continue" && result.chunk) {
        currentCtx = { ...currentCtx, chunk: result.chunk };
      }
    }
    return { action: "continue", chunk: currentCtx.chunk };
  }

  /**
   * Run the `beforeToolCall` hook chain.
   *
   * Middlewares can modify tool arguments, auto-approve the call, or deny
   * it. Both `"deny"` and `"approve"` short-circuit the chain.
   *
   * @param ctx - The tool call context.
   * @returns The final result with potentially modified arguments, or a terminal action.
   */
  async runBeforeToolCall(
    ctx: BeforeToolCallContext
  ): Promise<BeforeToolCallResult> {
    let currentCtx = { ...ctx };
    for (const mw of this.middlewares) {
      if (!mw.beforeToolCall) continue;
      const result = await mw.beforeToolCall(currentCtx);
      if (result.action === "deny" || result.action === "approve")
        return result;
      if (result.action === "continue" && result.args) {
        currentCtx = { ...currentCtx, toolArgs: result.args };
      }
    }
    return { action: "continue", args: currentCtx.toolArgs };
  }

  /**
   * Run the `afterToolResult` hook chain.
   *
   * Middlewares can transform or redact the tool result before it is sent
   * back to the AI model. Returning `{ action: "skip" }` discards the
   * result entirely.
   *
   * @param ctx - The tool result context.
   * @returns The final result — either a (possibly modified) tool result or a skip directive.
   */
  async runAfterToolResult(
    ctx: AfterToolResultContext
  ): Promise<AfterToolResultResult> {
    let currentCtx = { ...ctx };
    for (const mw of this.middlewares) {
      if (!mw.afterToolResult) continue;
      const result = await mw.afterToolResult(currentCtx);
      if (result.action === "skip") return result;
      if (result.action === "continue" && result.result !== undefined) {
        currentCtx = { ...currentCtx, result: result.result };
      }
    }
    return { action: "continue", result: currentCtx.result };
  }

  /**
   * Run the `beforeDisplay` hook chain.
   *
   * This is the final transformation step before a message is shown in the
   * UI or persisted to the store. Returning `{ action: "skip" }` suppresses
   * the message entirely.
   *
   * @param ctx - The display context.
   * @returns The final result — either a (possibly modified) message or a skip directive.
   */
  async runBeforeDisplay(
    ctx: BeforeDisplayContext
  ): Promise<BeforeDisplayResult> {
    let currentCtx = { ...ctx };
    for (const mw of this.middlewares) {
      if (!mw.beforeDisplay) continue;
      const result = await mw.beforeDisplay(currentCtx);
      if (result.action === "skip") return result;
      if (result.action === "continue" && result.message) {
        currentCtx = { ...currentCtx, message: result.message };
      }
    }
    return { action: "continue", message: currentCtx.message };
  }

  /**
   * Run the `onError` hook chain.
   *
   * Walks through each middleware's error handler. The first middleware that
   * returns an action other than `"default"` wins and short-circuits the
   * chain. If every middleware returns `"default"`, the built-in error
   * handling is used.
   *
   * @param ctx - The error context.
   * @returns The chosen error recovery strategy.
   */
  async runOnError(ctx: ErrorContext): Promise<ErrorResult> {
    for (const mw of this.middlewares) {
      if (!mw.onError) continue;
      const result = await mw.onError(ctx);
      if (result.action !== "default") return result;
    }
    return { action: "default" };
  }
}
