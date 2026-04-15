import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Profile, TAttachmentFile, TAttachmentImage } from "../types";

// --- beforeSend ---

/**
 * Context passed to the `beforeSend` middleware hook.
 *
 * Carries the full outgoing user message payload before it is sent to the
 * AI provider. Middleware can inspect or modify any field and either allow
 * the message through or block it entirely.
 */
export interface BeforeSendContext {
  /** The raw text content of the user message. */
  text: string;

  /** File attachments included with the message (PDFs, documents, etc.). */
  files: TAttachmentFile[];

  /** Image attachments included with the message. */
  images: TAttachmentImage[];

  /** ID of the thread the message belongs to. */
  threadId: string;

  /** The active AI profile, or `null` if none is selected. */
  profile: Profile | null;

  /** Messages already present in the thread before this send. */
  existingMessages: ThreadMessageLike[];
}

/**
 * Result returned from a `beforeSend` middleware hook.
 *
 * - `"continue"` — allow the message, optionally replacing text/files/images.
 * - `"block"` — prevent the message from being sent.
 */
export type BeforeSendResult =
  | {
      action: "continue";
      text?: string;
      files?: TAttachmentFile[];
      images?: TAttachmentImage[];
    }
  | { action: "block"; reason?: string };

// --- onStreamChunk ---

/**
 * Context passed to the `onStreamChunk` middleware hook.
 *
 * Delivered once per chunk as the AI model streams its response. Middleware
 * can transform the chunk content or skip individual chunks.
 */
export interface StreamChunkContext {
  /** The current streamed chunk from the model. */
  chunk: ThreadMessageLike;

  /** ID of the thread receiving the stream. */
  threadId: string;

  /** Unique identifier for the assistant message being streamed. */
  messageUID: string;

  /** `true` only for the very first chunk of the stream. */
  isFirst: boolean;
}

/**
 * Result returned from an `onStreamChunk` middleware hook.
 *
 * - `"continue"` — pass the chunk through, optionally replacing it.
 * - `"skip"` — drop this chunk entirely (it will not reach the UI).
 */
export type StreamChunkResult =
  | { action: "continue"; chunk?: ThreadMessageLike }
  | { action: "skip" };

// --- beforeToolCall ---

/**
 * Context passed to the `beforeToolCall` middleware hook.
 *
 * Provided just before a tool call is executed. Middleware can modify
 * arguments, auto-approve the call, or deny it outright.
 */
export interface BeforeToolCallContext {
  /** The name of the tool about to be invoked. */
  toolName: string;

  /** The arguments the model provided for the tool call. */
  toolArgs: Record<string, unknown>;

  /** Identifier of the tool source (e.g. host group id, `"web-search"`, `"mcp-{name}"`). */
  toolSource: string;

  /** ID of the thread where the tool call originates. */
  threadId: string;

  /** Unique identifier for the assistant message that requested the tool call. */
  messageUID: string;
}

/**
 * Result returned from a `beforeToolCall` middleware hook.
 *
 * - `"continue"` — proceed through the middleware chain, optionally with modified args.
 * - `"deny"` — reject the tool call (short-circuits the chain).
 * - `"approve"` — auto-approve without showing an approval dialog (short-circuits the chain).
 */
export type BeforeToolCallResult =
  | { action: "continue"; args?: Record<string, unknown> }
  | { action: "deny"; reason?: string }
  | { action: "approve" };

// --- afterToolResult ---

/**
 * Context passed to the `afterToolResult` middleware hook.
 *
 * Delivered after a tool has executed successfully. Middleware can transform
 * or redact the result before it is sent back to the AI model.
 */
export interface AfterToolResultContext {
  /** The name of the tool that was executed. */
  toolName: string;

  /** The arguments the tool was called with. */
  toolArgs: Record<string, unknown>;

  /** The raw result returned by the tool handler. */
  result: unknown;

  /** ID of the thread where the tool call occurred. */
  threadId: string;
}

/**
 * Result returned from an `afterToolResult` middleware hook.
 *
 * - `"continue"` — pass the result through, optionally replacing it.
 * - `"skip"` — discard the tool result so the model never sees it.
 */
export type AfterToolResultResult =
  | { action: "continue"; result?: unknown }
  | { action: "skip" };

// --- beforeDisplay ---

/**
 * Context passed to the `beforeDisplay` middleware hook.
 *
 * Delivered just before a message is rendered in the UI or persisted to the
 * store. This is the final transformation opportunity.
 */
export interface BeforeDisplayContext {
  /** The message about to be displayed. */
  message: ThreadMessageLike;

  /** ID of the thread the message belongs to. */
  threadId: string;

  /** `true` if the message is still being streamed from the model. */
  isStreaming: boolean;
}

/**
 * Result returned from a `beforeDisplay` middleware hook.
 *
 * - `"continue"` — display the message, optionally replacing it.
 * - `"skip"` — suppress the message from being shown in the UI.
 */
export type BeforeDisplayResult =
  | { action: "continue"; message?: ThreadMessageLike }
  | { action: "skip" };

// --- onError ---

/**
 * Context passed to the `onError` middleware hook.
 *
 * Delivered whenever an error occurs during the chat lifecycle. Middleware
 * can decide how to handle the error: use default behavior, retry, fall
 * back to another profile, or suppress it entirely.
 */
export interface ErrorContext {
  /** The error that occurred (may be an `Error` instance or an arbitrary value). */
  error: unknown;

  /** Category of the error to help middleware decide on a recovery strategy. */
  type: "provider" | "tool" | "network" | "storage";

  /** ID of the thread where the error occurred, if available. */
  threadId?: string;

  /** Unique identifier for the message that triggered the error, if available. */
  messageUID?: string;

  /** The AI profile in use when the error occurred, if available. */
  profile?: Profile;
}

/**
 * Result returned from an `onError` middleware hook.
 *
 * - `"default"` — use the built-in error handling (continues the chain).
 * - `"retry"` — retry the failed operation, optionally after a delay in ms.
 * - `"fallback"` — switch to a different AI profile and retry.
 * - `"suppress"` — silently swallow the error (no UI feedback).
 */
export type ErrorResult =
  | { action: "default" }
  | { action: "retry"; delay?: number }
  | { action: "fallback"; profileId: string }
  | { action: "suppress" };

// --- ChatMiddleware ---

/**
 * A middleware that can intercept and transform data at various points in the
 * chat lifecycle. All hooks are optional — implement only the ones you need.
 *
 * Middlewares are executed in the order they are registered. Each hook
 * receives context from the previous middleware in the chain. A blocking
 * action (e.g. `"block"`, `"deny"`, `"skip"`, `"suppress"`) short-circuits
 * the remaining chain.
 *
 * @example
 * ```ts
 * // Content filter middleware that blocks messages containing forbidden words
 * const contentFilter: ChatMiddleware = {
 *   beforeSend: async (ctx) => {
 *     const forbidden = ["spam", "phishing"];
 *     const lower = ctx.text.toLowerCase();
 *     if (forbidden.some((word) => lower.includes(word))) {
 *       return { action: "block", reason: "Message contains forbidden content" };
 *     }
 *     return { action: "continue" };
 *   },
 *   onError: async (ctx) => {
 *     if (ctx.type === "provider") {
 *       return { action: "retry", delay: 1000 };
 *     }
 *     return { action: "default" };
 *   },
 * };
 * ```
 */
export interface ChatMiddleware {
  /** Intercept before sending user message. Return "block" to prevent sending. */
  beforeSend?: (
    context: BeforeSendContext,
  ) => BeforeSendResult | Promise<BeforeSendResult>;

  /** Intercept each stream chunk from the model. */
  onStreamChunk?: (
    context: StreamChunkContext,
  ) => StreamChunkResult | Promise<StreamChunkResult>;

  /** Intercept before executing a tool call. */
  beforeToolCall?: (
    context: BeforeToolCallContext,
  ) => BeforeToolCallResult | Promise<BeforeToolCallResult>;

  /** Intercept tool call result before sending back to model. */
  afterToolResult?: (
    context: AfterToolResultContext,
  ) => AfterToolResultResult | Promise<AfterToolResultResult>;

  /** Intercept message before adding to store (final transformation). */
  beforeDisplay?: (
    context: BeforeDisplayContext,
  ) => BeforeDisplayResult | Promise<BeforeDisplayResult>;

  /** Intercept errors — retry, fallback, logging. */
  onError?: (context: ErrorContext) => ErrorResult | Promise<ErrorResult>;
}
