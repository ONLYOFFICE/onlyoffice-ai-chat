import type { Page } from "../store/create-router-store";
import type {
  Profile,
  TAttachmentFile,
  TAttachmentImage,
  Thread,
} from "../types";

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
}
