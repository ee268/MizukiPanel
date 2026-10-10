import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RecoveryRegistry } from "../src/client/auth/session-recovery";
import { SessionLifecycle } from "../src/client/auth/session-lifecycle";
import type { PanelSessionStatus } from "../src/shared/session";
const status = (key = "one"): PanelSessionStatus => ({
  authenticated: true,
  key,
  createdAt: "2026-10-10T00:00:00Z",
  lastActivityAt: "2026-10-10T00:00:00Z",
  expiresAt: null,
  policy: { idleEnabled: false, idleMinutes: 30, maximumEnabled: false, maximumHours: 24 },
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("flushes widgets before saving complete drafts and waits for persistence before navigation", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  const order: string[] = [];
  let source = "old";
  lifecycle.recovery.register({
    label: "draft",
    snapshot: () => ({ source }),
    save: async () => {
      order.push("save " + source);
    },
  });
  lifecycle.recovery.register({
    label: "editor",
    prepare: () => {
      source = "latest";
      order.push("flush");
    },
    save: async () => {},
    snapshot: () => null,
  });
  const pending = lifecycle.end("idle", "expired");
  await vi.advanceTimersByTimeAsync(1000);
  await pending;
  expect(order).toEqual(["flush", "save latest"]);
  expect(navigate).toHaveBeenCalledOnce();
  expect(lifecycle.canNavigate()).toBe(true);
  source = "pending widget input";
  expect(lifecycle.recovery.capture()[0].data).toEqual({ source: "latest" });
});
it("holds input and offers recovery snapshots after a failed save, then retries without revoking twice", async () => {
  const navigate = vi.fn();
  const revoke = vi.fn(async () => {});
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  let fail = true;
  lifecycle.recovery.register({
    label: "draft",
    save: async () => {
      if (fail) throw new Error("quota");
    },
    snapshot: () => ({ source: "unsaved", frontmatter: [{ key: "custom", value: "latest" }] }),
  });
  await lifecycle.end("logout", "logout", undefined, revoke);
  expect(navigate).not.toHaveBeenCalled();
  expect(revoke).not.toHaveBeenCalled();
  expect(lifecycle.getState().exit?.errors[0]).toContain("quota");
  expect(lifecycle.recovery.capture()[0].data).toMatchObject({ source: "unsaved" });
  fail = false;
  const retry = lifecycle.retry();
  await vi.advanceTimersByTimeAsync(1000);
  await retry;
  expect(revoke).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledOnce();
});
it("ignores duplicate and stale expiry reports and cancels pending exits after a new login", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  const epoch = lifecycle.getEpoch();
  let release!: () => void;
  lifecycle.recovery.register({
    label: "draft",
    save: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    snapshot: () => null,
  });
  const pending = lifecycle.end("idle", "expired", epoch);
  await lifecycle.end("invalid", "duplicate", epoch);
  lifecycle.adopt(status("new"));
  release();
  await pending;
  expect(navigate).not.toHaveBeenCalled();
  expect(lifecycle.getState().exit).toBeNull();
  await lifecycle.end("invalid", "old response", epoch);
  expect(lifecycle.getState().exit).toBeNull();
});
it("captures independent participants and handles persistence timeouts without navigating", async () => {
  const registry = new RecoveryRegistry();
  registry.register({
    label: "draft",
    save: () => new Promise(() => {}),
    snapshot: () => ({ source: "keep" }),
  });
  registry.register({
    label: "settings",
    save: async () => {
      throw new Error("not saved");
    },
    snapshot: () => ({ hue: 200 }),
  });
  const saving = registry.save(100);
  await vi.advanceTimersByTimeAsync(100);
  expect(await saving).toContain("保存恢复副本超时，输入仍保留。");
  expect(registry.capture()).toHaveLength(2);
});
it("keeps the page when server logout fails and allows cancelling a voluntary exit", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  const pending = lifecycle.end("logout", "logout", undefined, async () => {
    throw new Error("network");
  });
  await vi.advanceTimersByTimeAsync(1000);
  await pending;
  expect(navigate).not.toHaveBeenCalled();
  expect(lifecycle.getState().exit?.errors).toEqual(["network"]);
  lifecycle.cancel();
  expect(lifecycle.getState().exit).toBeNull();
  expect(lifecycle.canNavigate()).toBe(false);
});
it("allows explicit abandonment or downloaded recovery after expiry while retaining the snapshot", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  lifecycle.recovery.register({
    label: "settings",
    save: async () => {
      throw new Error("unsaved");
    },
    snapshot: () => ({ hue: 210 }),
  });
  await lifecycle.end("maximum", "expired");
  lifecycle.cancel();
  expect(lifecycle.getState().exit).not.toBeNull();
  const finishing = lifecycle.finish();
  await vi.advanceTimersByTimeAsync(1000);
  await finishing;
  expect(navigate).toHaveBeenCalledOnce();
  expect(lifecycle.recovery.capture()[0].data).toEqual({ hue: 210 });
});

it("keeps the saving dialog open for at least one second before logging out", async () => {
  const navigate = vi.fn();
  const revoke = vi.fn(async () => {});
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  lifecycle.recovery.register({
    label: "draft",
    save: async () => {},
    snapshot: () => ({ source: "changed" }),
  });
  const pending = lifecycle.end("logout", "logout", undefined, revoke);
  await vi.advanceTimersByTimeAsync(999);
  expect(lifecycle.getState().exit?.working).toBe(true);
  expect(lifecycle.getState().exit?.showDialog).toBe(true);
  expect(lifecycle.canNavigate()).toBe(false);
  expect(revoke).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await pending;
  expect(revoke).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledOnce();
});

it("waits for a slower save without adding another second", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  let release!: () => void;
  lifecycle.recovery.register({
    label: "draft",
    save: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    snapshot: () => ({ source: "changed" }),
  });
  const pending = lifecycle.end("logout", "logout");
  await vi.advanceTimersByTimeAsync(3000);
  expect(navigate).not.toHaveBeenCalled();
  release();
  await pending;
  expect(navigate).toHaveBeenCalledOnce();
});

it.each(["cancel", "new login"])("ignores delayed logout after %s", async (action) => {
  const navigate = vi.fn();
  const revoke = vi.fn(async () => {});
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  lifecycle.recovery.register({
    label: "draft",
    save: async () => {},
    snapshot: () => ({ source: "changed" }),
  });
  const pending = lifecycle.end("logout", "logout", undefined, revoke);
  await vi.advanceTimersByTimeAsync(500);
  if (action === "cancel") lifecycle.cancel();
  else lifecycle.adopt(status("new"));
  await vi.advanceTimersByTimeAsync(500);
  await pending;
  expect(revoke).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(lifecycle.getState().exit).toBeNull();
});

it.each([false, true])(
  "logs out without showing a dialog when there are no changes (registered: %s)",
  async (registered) => {
    const navigate = vi.fn();
    const revoke = vi.fn(async () => {});
    const lifecycle = new SessionLifecycle(navigate);
    lifecycle.adopt(status());
    if (registered)
      lifecycle.recovery.register({
        label: "clean form",
        save: async () => {},
        snapshot: () => null,
      });
    const shown: boolean[] = [];
    lifecycle.subscribe(() => shown.push(Boolean(lifecycle.getState().exit?.showDialog)));
    await lifecycle.end("logout", "logout", undefined, revoke);
    expect(shown).not.toContain(true);
    expect(revoke).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(lifecycle.canNavigate()).toBe(true);
  },
);

it("detects pending widget changes before deciding whether to show the dialog", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  let dirty = false;
  lifecycle.recovery.register({
    label: "draft",
    save: async () => {},
    snapshot: () => (dirty ? { source: "pending" } : null),
  });
  lifecycle.recovery.register({
    label: "editor",
    prepare: () => {
      dirty = true;
    },
    save: async () => {},
    snapshot: () => null,
  });
  const pending = lifecycle.end("logout", "logout");
  expect(lifecycle.getState().exit?.showDialog).toBe(true);
  await vi.advanceTimersByTimeAsync(999);
  expect(navigate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await pending;
  expect(navigate).toHaveBeenCalledOnce();
});

it("shows an error dialog if logout fails even when there are no changes", async () => {
  const navigate = vi.fn();
  const lifecycle = new SessionLifecycle(navigate);
  lifecycle.adopt(status());
  await lifecycle.end("logout", "logout", undefined, async () => {
    throw new Error("network");
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(lifecycle.getState().exit).toMatchObject({
    showDialog: true,
    working: false,
    errors: ["network"],
  });
});
