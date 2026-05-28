import type { BuiltinProviderType } from "../../../shared/builtin-provider-type";
import type { TErrorData } from "../../../shared/error-data";
import type { ImageGenerationArgs } from "../../../shared/image-generation-args";
import type { Model } from "../../../shared/model";
import type { ProviderCredentials } from "../../../shared/provider-credentials";
import type {
  SendMessageArgs,
  SendMessageResult,
} from "../../../shared/send-message-args";
import type { SendMessageSyncArgs } from "../../../shared/send-message-sync-args";
import { AbstractBaseProvider, type ProviderConstructor } from "../base";
import { OpenAIProvider } from "../openai";
import { externalInfo } from "./info";

/**
 * Inner providers whose response parsers the External provider can
 * delegate to. Currently only OpenAI is implemented; the other
 * placeholders document the reserved values exposed through
 * `BuiltinProviderType` for `Profile.basedOn`.
 */
const SUPPORTED_BASED_ON = {
  openai: OpenAIProvider,
} satisfies Partial<Record<BuiltinProviderType, ProviderConstructor>>;

function resolveInnerCtor(
  basedOn: BuiltinProviderType | undefined
): ProviderConstructor {
  if (!basedOn) {
    throw new Error(
      'ExternalProvider: Profile.basedOn is required (e.g. "openai")'
    );
  }
  const ctor = (SUPPORTED_BASED_ON as Record<string, ProviderConstructor>)[
    basedOn
  ];
  if (!ctor) {
    throw new Error(
      `ExternalProvider: basedOn "${basedOn}" is not supported yet`
    );
  }
  return ctor;
}

/**
 * Built-in provider with no transport of its own.
 *
 * The class is a thin delegate: every call (streaming, sync, image
 * generation, model listing, connection check) is forwarded to an
 * inner provider class selected by `creds.basedOn`. The inner SDK
 * receives the exact same `creds`, including `creds.fetch` — the
 * engine sets this to `PlatformAdapter.externalFetch` for any profile
 * with `providerType: "external"`, so the host controls every HTTP
 * call while the library keeps reusing existing response parsers.
 */
class ExternalProvider extends AbstractBaseProvider {
  private inner: AbstractBaseProvider;

  constructor(creds: ProviderCredentials) {
    super(creds);
    const Ctor = resolveInnerCtor(creds.basedOn);
    this.inner = new Ctor(creds);
  }

  sendMessage(args: SendMessageArgs): AsyncGenerator<SendMessageResult> {
    return this.inner.sendMessage(args);
  }

  sendMessageSync(args: SendMessageSyncArgs): Promise<string> {
    return this.inner.sendMessageSync(args);
  }

  imageGeneration(args: ImageGenerationArgs): Promise<string> {
    if (!this.inner.imageGeneration) {
      throw new Error(
        `ExternalProvider: inner provider "${this.creds.basedOn}" does not implement imageGeneration`
      );
    }
    return this.inner.imageGeneration(args);
  }

  checkResponsesApi(modelId: string, signal?: AbortSignal): Promise<boolean> {
    return this.inner.checkResponsesApi(modelId, signal);
  }

  static getName(): string {
    return externalInfo.name;
  }

  static getBaseUrl(): string {
    return externalInfo.baseUrl;
  }

  static async checkProvider(
    creds: ProviderCredentials
  ): Promise<boolean | TErrorData> {
    const Ctor = resolveInnerCtor(creds.basedOn);
    return Ctor.checkProvider(creds);
  }

  static async getProviderModels(creds: ProviderCredentials): Promise<Model[]> {
    const Ctor = resolveInnerCtor(creds.basedOn);
    return Ctor.getProviderModels(creds);
  }
}

export { ExternalProvider };
