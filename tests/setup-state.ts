import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

const directory = await mkdtemp(path.join(tmpdir(), "mizuki-panel-test-state-"));
process.env.MIZUKI_PANEL_TEST_STATE_DIR = directory;
afterAll(async () => {
  delete process.env.MIZUKI_PANEL_TEST_STATE_DIR;
  await rm(directory, { recursive: true, force: true });
});
