import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { expect, it, vi } from "vitest";
import { waitForApiReady } from "../scripts/dev-startup.mjs";

function apiChild() {
  return Object.assign(new EventEmitter(), { exitCode: null, signalCode: null }) as ChildProcess;
}

it("holds frontend startup until the API reports its listening socket is ready", async () => {
  const api = apiChild();
  const startFrontend = vi.fn();
  const ready = waitForApiReady(api, new AbortController().signal).then(startFrontend);
  api.emit("message", { type: "unrelated" });
  await Promise.resolve();
  expect(startFrontend).not.toHaveBeenCalled();
  api.emit("message", { type: "mizuki-panel:api-ready" });
  await ready;
  expect(startFrontend).toHaveBeenCalledTimes(1);
  expect(api.eventNames()).toEqual([]);
});

it("does not launch the frontend if API startup fails or is interrupted", async () => {
  for (const action of ["exit", "abort"] as const) {
    const api = apiChild();
    const controller = new AbortController();
    const ready = waitForApiReady(api, controller.signal);
    const rejected = expect(ready).rejects.toBeInstanceOf(Error);
    if (action === "exit") api.emit("exit", 1);
    else controller.abort();
    await rejected;
    expect(api.eventNames()).toEqual([]);
  }
});
