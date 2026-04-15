import { useI18n } from "../locales";

/**
 * Returns the current text direction based on the active locale.
 *
 * @deprecated Use `useI18n()` directly — it provides `isRTL` and `direction`.
 * @returns An object with `isRTL` (boolean) and `direction` (`"ltr"` | `"rtl"`).
 */
export const useDirection = () => {
  const { isRTL, direction } = useI18n();
  return { isRTL, direction };
};
