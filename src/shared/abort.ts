/**
 * Normalize cancellation detection across SDKs. Checks both the explicit
 * `signal.aborted` flag and errors thrown by `fetch`/SDK clients when a
 * signal fires mid-request.
 *
 * @param error  - The error caught from an SDK call or `fetch`.
 * @param signal - The `AbortSignal` that was passed in, if any.
 * @returns `true` when the error indicates the caller aborted.
 */
export const isAbortError = (
  error: unknown,
  signal?: AbortSignal
): boolean => {
  if (signal?.aborted) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
};
