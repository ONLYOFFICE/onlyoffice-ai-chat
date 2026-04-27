import { useEffect, useMemo, useRef } from "react";
import { debounce } from "../shared/debounce";

/**
 * Returns a debounced version of the given callback that delays invocation
 * until `delay` ms have elapsed since the last call. The debounced function
 * is automatically cancelled on unmount.
 *
 * @param callback - The function to debounce.
 * @param delay - Debounce delay in milliseconds.
 * @returns A debounced function with a `.cancel()` method.
 */
export const useDebouncedCallback = <T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useMemo(
    () => debounce((...args: T) => callbackRef.current(...args), delay),
    [delay]
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
};
