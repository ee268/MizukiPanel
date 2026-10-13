import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "../src/client/api";
import { connectSession } from "../src/client/auth/session-connection";

afterEach(() => vi.useRealTimers());

it("recovers after many proxy and network failures without a reconnection limit", async () => {
  vi.useFakeTimers();
  let calls = 0;
  const reconnect = vi.fn();
  const request = vi.fn(async () => {
    calls++;
    if (calls <= 20) {
      if (calls % 2) throw new ApiError(500, "API not ready");
      throw new TypeError("Failed to fetch");
    }
    return { authenticated: true };
  });
  const result = connectSession(request, new AbortController().signal, reconnect);
  await vi.runAllTimersAsync();
  await expect(result).resolves.toEqual({ authenticated: true });
  expect(request).toHaveBeenCalledTimes(21);
  expect(reconnect).toHaveBeenCalledTimes(20);
  expect(vi.getTimerCount()).toBe(0);
});

it("stops on an invalid session so the page can return to login", async () => {
  const request = vi.fn().mockRejectedValue(new ApiError(401, "登录已失效"));
  const reconnect = vi.fn();
  await expect(
    connectSession(request, new AbortController().signal, reconnect),
  ).rejects.toMatchObject({ status: 401 });
  expect(request).toHaveBeenCalledTimes(1);
  expect(reconnect).not.toHaveBeenCalled();
});

it("cancels pending backoff when the page leaves", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const request = vi.fn().mockRejectedValue(new ApiError(503, "Starting"));
  const result = connectSession(request, controller.signal, vi.fn());
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await rejected;
  await vi.runAllTimersAsync();
  expect(request).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("times out a stalled request and connects on the next attempt", async () => {
  vi.useFakeTimers();
  const request = vi
    .fn<(signal: AbortSignal) => Promise<string>>()
    .mockImplementationOnce(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    )
    .mockResolvedValue("ready");
  const result = connectSession(request, new AbortController().signal, vi.fn());
  await vi.advanceTimersByTimeAsync(10500);
  await expect(result).resolves.toBe("ready");
  expect(request).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("aborts an in-flight probe on cleanup and never schedules another attempt", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const request = vi.fn(
    (signal: AbortSignal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
  const result = connectSession(request, controller.signal, vi.fn());
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
  expect(request).toHaveBeenCalledTimes(1);
});
