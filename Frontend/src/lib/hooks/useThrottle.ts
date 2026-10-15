import { useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook that returns a throttled version of the callback function.
 * Ensures the function is called at most once per limitMs window.
 * Automatically cleans up timers on unmount.
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limitMs: number = 500
) {
  const callbackRef = useRef<T>(callback);
  const lastCallRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastCallRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = limitMs - (now - lastCallRef.current);

      if (remaining <= 0 || remaining > limitMs) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timerRef.current = null;
          callbackRef.current(...args);
        }, remaining);
      }
    },
    [limitMs]
  );

  return Object.assign(throttledFn, { cancel });
}
