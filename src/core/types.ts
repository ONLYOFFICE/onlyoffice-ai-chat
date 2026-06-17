import type { BuiltinProviderType } from "../shared/builtin-provider-type";
import type { TMCPItem } from "../shared/mcp-item";
import type { Model } from "../shared/model";
import type { TProvider } from "../shared/provider";
import type { ProviderType } from "../shared/provider-type";

export type { BuiltinProviderType, Model, ProviderType, TMCPItem, TProvider };

/**
 * Chat conversation metadata. Represents a single chat session (thread).
 *
 * @example
 * ```ts
 * const thread: Thread = {
 *   threadId: "abc-123",
 *   title: "Help with TypeScript generics",
 *   lastEditDate: Date.now(),
 *   profileId: "profile-456",
 * };
 * ```
 */
export type Thread = {
  /** Unique thread identifier (UUID). */
  threadId: string;

  /** Optional thread title. Auto-generated from the first message if not set. */
  title?: string;

  /** Timestamp (ms since epoch) of the last message in this thread. Used for sorting. */
  lastEditDate?: number;

  /** Provider configuration at the time of last message. Used for thread-level provider display. */
  provider?: TProvider;

  /** Model info at the time of last message. */
  model?: Model;

  /** ID of the profile used for this thread. Links to {@link Profile.id}. */
  profileId?: string;
};

/**
 * Folder for organizing saved prompts.
 *
 * @see {@link Prompt} for prompts that belong to a folder.
 */
export type PromptFolder = {
  /** Unique folder identifier (UUID). */
  id: string;

  /** Folder display name. */
  name: string;

  /** Timestamp (ms since epoch) when the folder was created. */
  createdAt: number;

  /** Timestamp (ms since epoch) of the last folder modification. */
  updatedAt: number;
};

/**
 * Saved prompt template that users can quickly insert into the chat.
 *
 * @example
 * ```ts
 * const prompt: Prompt = {
 *   id: "p-1",
 *   name: "Summarize",
 *   text: "Summarize the following text in 3 bullet points:\n\n{text}",
 *   createdAt: Date.now(),
 *   updatedAt: Date.now(),
 * };
 * ```
 *
 * @see {@link PromptFolder} for folder organization.
 */
export type Prompt = {
  /** Unique prompt identifier (UUID). */
  id: string;

  /** Prompt display name shown in the prompt picker. */
  name: string;

  /** Prompt template text. May contain placeholder tokens. */
  text: string;

  /** Optional parent folder ID. `undefined` means the prompt is at the root level. */
  folderId?: string;

  /** Timestamp (ms since epoch) when the prompt was created. */
  createdAt: number;

  /** Timestamp (ms since epoch) of the last prompt modification. */
  updatedAt: number;
};

/**
 * File attachment for sending documents to the AI model.
 * Files are converted to text before being sent to the provider.
 */
export type TAttachmentFile = {
  /** File path in the host application's file system. */
  path: string;

  /** Extracted text content of the file. */
  content: string;

  /** ONLYOFFICE file type code (used by {@link PlatformFileOperations.getFileType}). */
  type: number;
};

/**
 * Image attachment for sending images to the AI model (vision/OCR).
 */
export type TAttachmentImage = {
  /** Image file name (e.g. `"screenshot.png"`). */
  name: string;

  /** Base64-encoded image data. */
  base64: string;
};

/**
 * Lightweight attachment reference held by composer drafts and
 * surfaced through middleware/callbacks. The full payload lives in
 * `storage.attachments` and is hydrated by core just before the
 * provider sees the message.
 */
export type TAttachmentRef = {
  /** Storage-assigned id (UUID). */
  id: string;
  /** Display label (filename or user-visible title). */
  title: string;
  /** Discriminates between files and images. */
  kind: "file" | "image";
  /** Original host file path (only for `kind === "file"`). */
  path?: string;
  /** ONLYOFFICE file type code (only for `kind === "file"`). */
  type?: number;
};

/**
 * Handle to an external process spawned for MCP STDIO server transport.
 *
 * @see {@link PlatformProcessRunner.createProcess}
 */
export type TProcess = {
  /** Write data to the process's standard input (JSON-RPC messages). */
  stdin: (data: string) => void;

  /** Register a handler for process output. `type`: 0 = stdout, 1 = stderr. */
  onprocess: (type: number, message: string) => void;

  /** Terminate the process. */
  end: () => void;

  /** Start the process. */
  start: () => void;
};

/**
 * Complete AI provider + model configuration saved by the user.
 * Profiles are the primary way users save and reuse provider configurations.
 *
 * @example
 * ```ts
 * const profile: Profile = {
 *   id: "prof-1",
 *   name: "Claude Sonnet",
 *   providerType: "anthropic",
 *   baseUrl: "https://api.anthropic.com",
 *   key: "sk-ant-...",
 *   modelId: "claude-sonnet-4-20250514",
 *   reasoning: true,
 *   capabilities: 0b0001_0011,
 * };
 * ```
 *
 * @see {@link TProvider} for the minimal connection config derived from a profile.
 */
export type Profile = {
  /** Unique profile identifier (UUID). */
  id: string;

  /** User-defined profile display name. */
  name: string;

  /**
   * Provider type for this profile. Use `"external"` to delegate all
   * HTTP transport to {@link PlatformAdapter.externalFetch} while
   * reusing an existing provider's response parser — see
   * {@link Profile.basedOn} for the format selector.
   */
  providerType: ProviderType;

  /**
   * Selects the response-format parser used by the `"external"`
   * provider. Ignored for any other `providerType`.
   *
   * Currently the only supported value is `"openai"` — passing
   * anything else raises an error at request time. Reserved values
   * (`"anthropic"`, `"mistral"`, `"genai"`, …) are accepted by the
   * type but not yet implemented.
   */
  basedOn?: BuiltinProviderType;

  /** Base URL of the provider API. */
  baseUrl: string;

  /** API key or token. Optional for local providers. */
  key?: string;

  /**
   * Extra HTTP headers sent with every request to this provider. Merged
   * into the SDK client's default headers; an explicit `Authorization`
   * here wins over the one derived from {@link key}. Honoured by the
   * OpenAI-family providers.
   */
  headers?: Record<string, string>;

  /** Selected model ID within this provider. */
  modelId: string;

  /** Whether extended thinking is enabled for this profile's model. */
  reasoning?: boolean;

  /** Bitmask of capabilities supported by the selected model. */
  capabilities?: number;

  /**
   * Result of the live tool-capability probe performed at create time and
   * on changes to `modelId` / `providerType` / `baseUrl`. `undefined` means
   * the probe has never run for this profile (legacy record).
   */
  canUseTool?: boolean;

  /**
   * Result of the live Responses-API probe (parallel to {@link canUseTool}).
   * `true` means the model speaks `/v1/responses` and the OpenAI provider
   * must route through `client.responses.create` — required for gpt-5+
   * reasoning models that reject `reasoning_effort` together with `tools`
   * on `/v1/chat/completions`. Probed at create time and whenever
   * `modelId` / `providerType` / `baseUrl` change. `undefined` means the
   * probe never ran (legacy record) — readers treat that as `false`.
   */
  useResponsesApi?: boolean;

  /** Whether this profile uses a cloud-hosted provider (e.g. ONLYOFFICE DocSpace). */
  isCloudProvider?: boolean;

  /**
   * Route every provider request through the host's `fetchProxy` instead
   * of the global `fetch`. Useful when the host runs the widget in a
   * sandbox without direct network access (CORS, custom auth, etc.).
   * Has no effect when the {@link PlatformAdapter.fetchProxy} is not
   * configured.
   */
  useProxy?: boolean;

  /** Creation timestamp (ms since epoch). Used to sort the AI models list newest-first. */
  createdAt?: number;
};

/**
 * Connected cloud account from the host application (e.g. ONLYOFFICE DocSpace portal).
 *
 * @see {@link PlatformClouds.getClouds}
 */
export type TCloud = {
  /** Cloud portal URL. */
  portal: string;

  /** Cloud provider identifier. */
  provider: string;

  /** User display name. */
  user: string;

  /** User email address. */
  email: string;
};

/**
 * Cloud API key configuration.
 *
 * @see {@link PlatformClouds.getCloudKeys}
 */
export type TCloudKey = {
  /** Cloud portal URL this key belongs to. */
  url: string;

  /** Available API keys for this portal. */
  keys: { id: string; value: string }[];
};

/**
 * Cloud provider connection configuration derived from cloud accounts or
 * from an external ONLYOFFICE AI config passed to the widget.
 */
export type TCloudProvider = {
  /** Provider API URL. */
  url: string;

  /** Display label for the cloud provider. */
  label: string;

  /** API key for authentication. Optional when provided by external ONLYOFFICE AI config. */
  apiKey?: string;
};

/**
 * Identifier of a built-in Web Search provider row shown in the Web Search
 * configuration page. Cloud-derived entries (from `PlatformClouds`) are
 * identified by their portal URL instead and are not part of this union.
 */
export type WebSearchProviderId = "Exa" | "ONLYOFFICE";

/**
 * External ONLYOFFICE AI provider configuration.
 *
 * When passed to {@link import("./AIChatWidget").AIChatWidgetProps.onlyofficeConfig},
 * makes the built-in ONLYOFFICE AI entry in Add/Edit model forms (and
 * Web Search) use the given base URL and (optional) API key. The URL/key
 * fields are hidden for that entry.
 */
export type TOnlyOfficeConfig = {
  /** Base URL of the ONLYOFFICE AI backend. */
  baseUrl: string;

  /** Optional API key. If omitted, requests are made without an Authorization header. */
  apiKey?: string;
};
