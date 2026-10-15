/**
 * Pure, zero-dependency timing utilities (Debounce & Throttle)
 */

export interface CancelableFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

/**
 * Delays invoking func until after wait milliseconds have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): CancelableFunction<T> {
  let timer: NodeJS.Timeout | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled function that only invokes func at most once per every limitMs milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number
): CancelableFunction<T> {
  let lastCall = 0;
  let timer: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = limitMs - (now - lastCall);
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > limitMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      lastArgs = null;
      lastThis = null;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        if (lastArgs) {
          const callArgs = lastArgs;
          const callThis = lastThis;
          lastArgs = null;
          lastThis = null;
          fn.apply(callThis, callArgs);
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastCall = 0;
    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}

