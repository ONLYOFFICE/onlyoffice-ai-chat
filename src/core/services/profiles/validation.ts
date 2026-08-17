import type { TErrorData } from "../../../shared/error-data";
import type { Profile } from "../../types";
import { loadProvider } from "../../providers";
import { credsOf } from "./lookup";

const NAME_EXISTS_ERROR: TErrorData = {
  field: "name",
  message: "Duplicate name",
};

const VALIDATION_FAILED_ERROR: TErrorData = {
  field: "key",
  message: "Provider validation failed",
};

/**
 * Run the two gating checks (name uniqueness + credential validity) on a
 * candidate profile. The caller supplies the existing profile list so the
 * validator stays a pure function of its inputs — it doesn't reach into
 * storage on its own.
 *
 * @returns The first error encountered, or `null` on success.
 */
export async function validateProfile(
  existing: Profile[],
  input: Pick<Profile, "name" | "providerType" | "baseUrl" | "key">,
  excludeId?: string
): Promise<TErrorData | null> {
  if (hasNameCollision(existing, input.name, excludeId)) {
    return NAME_EXISTS_ERROR;
  }

  const check = await checkCredentials(input);
  return check === true ? null : check;
}

/**
 * Ping the provider with the given credentials via its static
 * `checkProvider`. Normalises all failure shapes to {@link TErrorData}.
 */
export async function checkCredentials(
  input: Pick<Profile, "providerType" | "baseUrl" | "key">
): Promise<true | TErrorData> {
  const Provider = await loadProvider(input.providerType);
  if (!Provider) {
    return {
      field: "name",
      message: `Unknown provider type: ${input.providerType}`,
    };
  }
  // Always validated live (the model-list cache that used to prove creds
  // here is gone — shared-server instances must not keep cross-caller
  // state, see listProviderModels).
  const result = await Provider.checkProvider(credsOf(input));
  if (result === true) return true;
  if (result && typeof result === "object") return result;
  return VALIDATION_FAILED_ERROR;
}

function hasNameCollision(
  profiles: Profile[],
  name: string,
  excludeId?: string
): boolean {
  const normalized = name.toLowerCase();
  return profiles.some(
    (p) => p.name.toLowerCase() === normalized && p.id !== excludeId
  );
}
