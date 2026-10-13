import { ApiError } from "../api";

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Retry only the read-only session probe; never replay login or other mutations. */
export async function connectSession<T>(
  request: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  onReconnect: () => void,
): Promise<T> {
  let failures = 0;
  for (;;) {
    signal.throwIfAborted();
    const attempt = new AbortController();
    const abort = () => attempt.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(
      () => attempt.abort(new DOMException("连接超时", "TimeoutError")),
      10000,
    );
    try {
      return await request(attempt.signal);
    } catch (error) {
      signal.throwIfAborted();
      const transient =
        error instanceof TypeError ||
        attempt.signal.aborted ||
        (error instanceof ApiError &&
          (error.status >= 500 || error.status === 408 || error.status === 429));
      if (!transient) throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
    onReconnect();
    // Bound the delay, not the number of reconnections.
    await wait(Math.min(500 * 2 ** Math.min(failures++, 4), 5000), signal);
  }
}
