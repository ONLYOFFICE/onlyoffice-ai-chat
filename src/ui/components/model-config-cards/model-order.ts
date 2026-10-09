import type { Model } from "../../../types";

/**
 * Provider whose catalogue arrives already ordered by the server and is
 * therefore listed as-is.
 *
 * OpenRouter is asked for `?sort=most-popular`, a usage ranking that
 * exists purely as the response's array order — no field on a model
 * carries it. Re-sorting the list client-side would silently discard that
 * ranking, so the picker leaves this provider's order untouched.
 */
const SERVER_ORDERED_PROVIDER = "openrouter";

/**
 * The order the model picker lists a provider's models in. A server-ranked
 * catalogue keeps the order it arrived in; everything else is sorted newest
 * release first where the provider dates its models (`created`, Unix
 * seconds) and alphabetically otherwise. Dated models sort above undated
 * ones so a partially dated catalogue degrades predictably instead of
 * interleaving.
 *
 * The form's default model is picked from this same order: picked from the
 * raw response instead, it was whatever the provider happened to list
 * first — an old dated snapshot while the newest model topped the picker.
 *
 * @param models - The models as the provider returned them.
 * @param provider - The provider type the models came from.
 * @returns A new array in picker order; the input is not modified.
 */
export const orderModels = (models: Model[], provider: string): Model[] =>
  provider === SERVER_ORDERED_PROVIDER
    ? models
    : [...models].sort((a, b) => {
        if (a.created !== b.created) {
          if (a.created === undefined) return 1;
          if (b.created === undefined) return -1;
          return b.created - a.created;
        }
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      });
