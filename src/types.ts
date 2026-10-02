import type { ReasoningSupport } from "./shared/reasoning-level";
import type { ToolAnnotations } from "./shared/mcp-item";

export type { ToolAnnotations };

/**
 * Descriptor for a tool exposed by an MCP server.
 *
 * @example
 * ```ts
 * const tool: TMCPItem = {
 *   name: "web_search",
 *   description: "Search the web for information",
 *   inputSchema: { type: "object", properties: { query: { type: "string" } } },
 *   enabled: true,
 * };
 * ```
 */
export type TMCPItem = {
  /** Tool name as registered on the MCP server (e.g. `"web_search"`, `"insert_text"`). */
  name: string;

  /**
   * Optional human-readable name shown in the tools list UI. Falls back to
   * {@link name} if not provided. Never sent to the model.
   */
  displayName?: string;

  /** Human-readable description shown to the AI model and in the tools list UI. */
  description: string;

  /** JSON Schema describing the tool's input parameters. */
  inputSchema: Record<string, unknown>;

  /** Whether this tool is currently enabled. Disabled tools are hidden from the AI model. */
  enabled?: boolean;

  /**
   * Server type (MCP server name / host tool group id) this tool belongs
   * to — the key the persisted disabled map is stored under. Set by the
   * source that enumerated the tool, so a caller-supplied tool can still
   * be attributed to its group after being flattened into a single list:
   * that is what lets the engine apply the disabled map to
   * `actionArgs.tools` instead of trusting the caller to pre-filter.
   * Wire-serializable, so it survives a remote (server-side) engine.
   */
  serverType?: string;

  /**
   * Whether the consumer must show an approval dialog before this tool
   * runs. Feeds the `autoAllow` flag on a `tool-call-pending` event
   * together with the user's tool permission mode: `false` skips the
   * dialog under the "auto" mode (under "ask", the default, only the
   * persisted "always-allow" list does), `true` and `undefined` defer to
   * that list; "allow" skips it for every tool. Host tools set it (see
   * {@link import("./ui/tools/types").HostTool.requireApproval}); MCP /
   * custom-server tools leave it unset and keep prompting.
   */
  requireApproval?: boolean;

  /**
   * The MCP tool annotations as the server declared them in `tools/list`
   * (kept verbatim on the descriptor; never sent to the model). The
   * approval flow reads two of them under the "auto" permission mode:
   * `readOnlyHint: true` and `destructiveHint: false` run without the
   * dialog, a destructive or unannotated tool keeps asking — see
   * `resolveAutoAllow`. Wire-serializable.
   */
  annotations?: ToolAnnotations;
};

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
 * Union of all 17 built-in AI provider type identifiers.
 *
 * The `"external"` provider has no built-in transport — it delegates
 * every HTTP request to `PlatformAdapter.externalFetch` and parses the
 * response with the inner provider selected by `Profile.basedOn`.
 *
 * @see {@link ProviderType} for the full type that also accepts custom strings.
 */
export type BuiltinProviderType =
  | "anthropic"
  | "ollama"
  | "openai"
  | "openaicompatible"
  | "together"
  | "openrouter"
  | "genai"
  | "deepseek"
  | "xai"
  | "lm-studio"
  | "mistral"
  | "groq"
  | "zhipu"
  | "stabilityai"
  | "gpt4all"
  | "onlyoffice"
  | "external";

/**
 * Provider type identifier. Accepts all 17 built-in types with autocomplete,
 * plus any custom `string` for dynamically registered providers.
 *
 * @example
 * ```ts
 * const builtin: ProviderType = "anthropic"; // autocomplete works
 * const custom: ProviderType = "my-custom";  // also valid
 * ```
 *
 * @see {@link BuiltinProviderType} for just the built-in values.
 */
export type ProviderType = BuiltinProviderType | (string & {});

/**
 * AI model metadata. Describes a single model available from a provider.
 *
 * @example
 * ```ts
 * const model: Model = {
 *   id: "claude-sonnet-4-20250514",
 *   name: "Claude Sonnet 4",
 *   provider: "anthropic",
 *   reasoning: true,
 *   capabilities: 0b0001_0011, // Chat | Vision
 * };
 * ```
 */
export type Model = {
  /** Model identifier as used by the provider API (e.g. `"gpt-4o"`, `"claude-sonnet-4-20250514"`). */
  id: string;

  /** Human-readable model name for display in the UI. */
  name: string;

  /** Provider that offers this model. */
  provider: ProviderType;

  /** Whether this model supports extended thinking / chain-of-thought reasoning. */
  reasoning?: boolean;

  /**
   * What the model can do with extended thinking, when the provider's
   * catalogue says so (OpenRouter and the ONLYOFFICE route report a
   * per-model `reasoning` object). Copied onto the profile at save time;
   * absent, the widget falls back to the provider's id-based table.
   */
  reasoningSupport?: ReasoningSupport;

  /**
   * Bitmask of model capabilities (Chat, Image, Vision, Tools, etc.).
   * Used to filter models per {@link ActionType}.
   */
  capabilities?: number;

  /**
   * Release date as a Unix timestamp in **seconds**, when the provider's
   * catalogue reports one (OpenAI-shaped `/models` responses and
   * OpenRouter carry `created`; Anthropic carries an ISO `created_at`).
   * The model picker sorts on it so the newest releases come first;
   * entries without it fall back to alphabetical order.
   */
  created?: number;
};

/**
 * Minimal provider connection configuration. Used to connect to a provider API.
 *
 * @example
 * ```ts
 * const provider: TProvider = {
 *   type: "openai",
 *   name: "My OpenAI",
 *   baseUrl: "https://api.openai.com/v1",
 *   key: "sk-...",
 * };
 * ```
 */
export type TProvider = {
  /** Provider type identifier. */
  type: ProviderType;

  /** User-defined display name for this provider connection. */
  name: string;

  /** API key or token. Optional for local providers (Ollama, LM Studio). */
  key?: string;

  /** Base URL of the provider API. */
  baseUrl: string;
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
 *
 * Internal hydrated form — used by the resolver and storage records.
 * UI-side draft state and middleware/callbacks see {@link TAttachmentRef}.
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
 *
 * Internal hydrated form. UI-side draft state and middleware/callbacks
 * see {@link TAttachmentRef}.
 */
export type TAttachmentImage = {
  /** Image file name (e.g. `"screenshot.png"`). */
  name: string;

  /** Base64-encoded image data. */
  base64: string;
};

/**
 * Lightweight attachment reference held by the composer draft state and
 * passed into middleware (`beforeSend`) and the `onMessageSent` callback.
 *
 * The full payload (file text content / image base64) lives in
 * `storage.attachments` and is hydrated only inside core right before
 * the provider sees the message. Hosts that need raw content from a
 * middleware should call the `resolveAttachment(id)` helper available
 * on `BeforeSendContext`.
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
   * HTTP transport to `PlatformAdapter.externalFetch` while reusing an
   * existing provider's response parser — see {@link Profile.basedOn}.
   */
  providerType: ProviderType;

  /**
   * Selects the response-format parser used by the `"external"`
   * provider. Ignored for any other `providerType`. Supported values
   * are `"openai"`, `"anthropic"`, `"mistral"` and `"openrouter"`;
   * other values are reserved and throw at request time.
   */
  basedOn?: BuiltinProviderType;

  /** Base URL of the provider API. */
  baseUrl: string;

  /** API key or token. Optional for local providers. */
  key?: string;

  /**
   * Extra HTTP headers sent with every request to this provider (e.g. a
   * gateway token, a tenant id, a custom `Authorization`). Merged into the
   * SDK client's default headers; an explicit `Authorization` here wins
   * over the one derived from {@link key}. Honoured by the OpenAI-family
   * providers.
   */
  headers?: Record<string, string>;

  /** Selected model ID within this provider. */
  modelId: string;

  /** Whether extended thinking is enabled for this profile's model. */
  reasoning?: boolean;

  /**
   * Extended-thinking capabilities of the selected model as reported by
   * the provider's catalogue at save time (see {@link Model.reasoningSupport}).
   * When present the composer's Effort row follows it exactly; when absent
   * the provider's id-based table answers.
   */
  reasoningSupport?: ReasoningSupport;

  /** Bitmask of capabilities supported by the selected model. */
  capabilities?: number;

  /**
   * Result of the live tool-capability probe performed at create time and
   * on changes to `modelId` / `providerType` / `baseUrl`. `undefined` means
   * the probe has never run for this profile (legacy record).
   */
  canUseTool?: boolean;

  /** Whether this profile uses a cloud-hosted provider (e.g. ONLYOFFICE DocSpace). */
  isCloudProvider?: boolean;

  /**
   * Route every provider request through the host's `fetchProxy` instead
   * of the global `fetch`. Has no effect when the platform adapter does
   * not supply a `fetchProxy`.
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
