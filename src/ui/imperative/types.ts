import type { Page } from "../store/create-router-store";
import type {
  Profile,
  TAttachmentFile,
  TAttachmentImage,
  Thread,
} from "../../types";

/**
 * Imperative handle exposed by `AIChatWidget` via `React.forwardRef`.
 * Provides programmatic control over messages, threads, navigation,
 * profiles, and tool-call approval without going through the UI.
 *
 * @example
 * ```tsx
 * const ref = useRef<AIChatWidgetRef>(null);
 *
 * // Send a message programmatically
 * ref.current?.sendMessage("Summarize this document", {
 *   files: [{ path: "/doc.docx", type: 0x40, content: base64 }],
 * });
 *
 * // Switch to a different thread
 * ref.current?.switchThread("thread-abc-123");
 * ```
 */
export interface AIChatWidgetRef {
  // --- Messages ---

  /** Send a text message programmatically. */
  sendMessage(
    text: string,
    options?: {
      files?: TAttachmentFile[];
      images?: TAttachmentImage[];
    }
  ): void;

  /** Stop the current streaming response. */
  stopStreaming(): void;

  /** Returns `true` if a response is currently being streamed. */
  isStreaming(): boolean;

  // --- Threads ---

  /** Switch to an existing thread by ID. */
  switchThread(threadId: string): void;

  /** Create a new empty thread and switch to it. Returns the new thread ID. */
  createThread(): string;

  /** Delete a thread by ID. */
  deleteThread(threadId: string): void;

  /** Rename a thread. */
  renameThread(threadId: string, title: string): void;

  /** Clear all messages in a thread. */
  clearHistory(threadId: string): Promise<void>;

  /** Download a thread as a file. */
  downloadThread(threadId: string): void;

  /** Get all threads. */
  getThreads(): Thread[];

  /** Get the current thread ID. */
  getCurrentThreadId(): string;

  // --- Navigation ---

  /** Navigate to the chat page. */
  openChat(): void;

  /** Navigate to the settings page. */
  openSettings(): void;

  /** Navigate to the thread history page. */
  openHistory(): void;

  /** Get the current page. */
  getCurrentPage(): Page;

  // --- Profiles ---

  /** Get all profiles. */
  getProfiles(): Profile[];

  /** Set the active chat profile by ID. */
  setChatProfile(profileId: string): void;

  /** Get the currently active chat profile, or `null`. */
  getCurrentProfile(): Profile | null;

  // --- Tool calls ---

  /** Approve a pending tool call. */
  approveToolCall(options?: { allowAlways?: boolean }): void;

  /** Deny a pending tool call. */
  denyToolCall(): void;

  // --- External updates ---
  // Call these after the host mutates storage/settings out of band so the
  // widget re-syncs its in-memory state and any currently-open page.

  /** Re-read the profile list from storage. */
  updateProfiles(): Promise<void>;

  /** Re-read the thread list from storage. */
  updateThreads(): Promise<void>;

  /** Re-read the persisted chat profile from settings and re-apply it. */
  updateCurrentChat(): void;

  /** Re-read every task profile assignment (default + 7 tasks) from settings. */
  updateModelAssignment(): void;

  /** Re-read MCP server config from storage and rebuild the tool list. */
  updateMCPServer(): Promise<void>;

  /** Re-read the Web Search configuration from storage. */
  updateWebSearch(): void;

  /** Re-read the extended-thinking (deep-mode) flag from settings. */
  updateExtendedThinking(): void;

  // --- System prompt appendix ---

  /**
   * Set (or replace) the free-form text appended to the built-in system prompt
   * on every provider request. Persists to `SettingsAdapter` and re-applies to
   * all active providers. Passing an empty string behaves like
   * {@link clearSystemPromptAppendix}.
   */
  setSystemPromptAppendix(text: string): void;

  /** Remove the system-prompt appendix so providers use the built-in prompt alone. */
  clearSystemPromptAppendix(): void;

  /** Returns the current system-prompt appendix (empty string when unset). */
  getSystemPromptAppendix(): string;

  /**
   * Re-read the system-prompt appendix from settings after the host mutates
   * it out of band (e.g. cross-tab sync). Re-applies to all active providers
   * and emits `onSystemPromptAppendixUpdated` if the value changed.
   */
  updateSystemPromptAppendix(): void;
}
