import type { ChildProcess } from "node:child_process";

export function waitForApiReady(child: ChildProcess, signal: AbortSignal): Promise<void>;
