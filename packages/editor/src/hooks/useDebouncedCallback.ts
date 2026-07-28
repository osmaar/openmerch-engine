import { useEffect, useMemo, useRef } from 'react';

/**
 * Returns a stable, debounced wrapper around `callback`. Useful for commands
 * that are expensive per-call (e.g. anything that triggers `pushHistory`'s
 * deep clone) but fire on every tick of a continuous input, like dragging a
 * native `<input type="color">` picker. Only the trailing call survives the
 * `delayMs` window; pending calls are flushed immediately on unmount so no
 * final value is lost.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useMemo(() => {
    const debounced = (...args: Args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        callbackRef.current(...args);
      }, delayMs);
    };
    return debounced;
  }, [delayMs]);
}
