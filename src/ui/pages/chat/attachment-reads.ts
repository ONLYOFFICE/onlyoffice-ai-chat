/**
 * Shared file-reading plumbing for the attachment paths (drop and paste).
 *
 * Both paths reserve pending chips up front, read the files in parallel and
 * then have to reconcile per-file failures against those reservations, so the
 * read wrapper and the id/input partition live here rather than in either
 * hook — a fix to one read path applies to both.
 */

/**
 * Promise wrapper around `FileReader`. Rejects with the reader's error so
 * callers can decide per-file whether a failure is fatal.
 */
export const readFile = (
  file: File,
  as: "dataURL" | "text"
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    if (as === "dataURL") reader.readAsDataURL(file);
    else reader.readAsText(file);
  });

/**
 * Split parallel read results against their reserved pending ids: failures
 * (`null`) release their lease via `onFailed`, survivors come back with their
 * ids still aligned to the inputs.
 */
export const partitionReads = <T>(
  results: (T | null)[],
  ids: string[],
  onFailed: (failedIds: string[]) => void
) => {
  const inputs: T[] = [];
  const liveIds: string[] = [];
  const failedIds: string[] = [];
  results.forEach((result, i) => {
    if (result === null) {
      failedIds.push(ids[i]);
    } else {
      inputs.push(result);
      liveIds.push(ids[i]);
    }
  });
  if (failedIds.length > 0) onFailed(failedIds);
  return { inputs, liveIds };
};
