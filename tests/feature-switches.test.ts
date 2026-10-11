import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { featureIndex, setFeatureEnabled } from "../src/lib/server/features";
import { listConfigBackups, readConfig, restoreConfig } from "../src/lib/server/configs";
import { patchConfigBoolean } from "../src/lib/server/config-format";
import { withWorkspaceState } from "../src/lib/server/workspace-state";
import type { ProjectReport } from "../src/lib/server/project";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const source = `const TITLE = "Keep";
// preserve source comments and identifiers
export const siteConfig = {
  title: TITLE,
  featurePages: {
    friends: true, // keep this comment
    diary: false,
    customPage: true,
  },
  anime: { mode: "local" },
};
`;
async function fixture(mode: "local" | "external") {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-feature-switches-"));
  temporary.push(root);
  const contentRoot = path.join(root, "content");
  await mkdir(path.join(root, "src/config"), { recursive: true });
  await mkdir(path.join(contentRoot, "overrides"), { recursive: true });
  await writeFile(path.join(root, "src/config/siteConfig.ts"), source);
  await writeFile(
    path.join(root, "src/config/navBarConfig.ts"),
    "export const navBarConfig = { links: [] };\n",
  );
  const report: ProjectReport = {
    root,
    requestedPath: root,
    mode,
    readOnly: false,
    contentRoot: mode === "external" ? contentRoot : null,
    mappings: [],
    warnings: [],
  };
  return { root, contentRoot, report, state: path.join(root, "state") };
}

it("patches only the requested switch and creates recoverable siteConfig backups", async () => {
  const { root, report, state } = await fixture("local");
  await withWorkspaceState(state, async () => {
    const before = await featureIndex(report);
    const result = await setFeatureEnabled(report, "friends", false, before.siteConfigVersion);
    expect(result.enabled).toBe(false);
    expect(await readFile(path.join(root, "src/config/siteConfig.ts"), "utf8")).toBe(
      source.replace("friends: true", "friends: false"),
    );
    const after = await featureIndex(report);
    expect(after.modules.find((item) => item.key === "friends")?.enabled).toBe(false);
    expect(after.siteConfigVersion).toBe(result.siteConfigVersion);
    const backups = await listConfigBackups(report, "siteConfig");
    expect(backups).toHaveLength(1);
    await setFeatureEnabled(report, "friends", false, result.siteConfigVersion);
    expect(await listConfigBackups(report, "siteConfig")).toHaveLength(1);
    await restoreConfig(report, "siteConfig", backups[0].id, result.siteConfigVersion);
    expect(await readFile(path.join(root, "src/config/siteConfig.ts"), "utf8")).toBe(source);
  });
});

it("writes minimal external overrides without changing source defaults or unrelated overrides", async () => {
  const { root, contentRoot, report, state } = await fixture("external");
  await withWorkspaceState(state, async () => {
    const before = await featureIndex(report);
    expect(before.siteConfigVersion).toBe("");
    const disabled = await setFeatureEnabled(report, "friends", false, "");
    const first = await readConfig(report, "siteConfig");
    expect(first.overrideValue).toEqual({ featurePages: { friends: false } });
    expect(first.effectiveValue).toMatchObject({
      title: "Keep",
      featurePages: { friends: false, diary: false, customPage: true },
    });
    await setFeatureEnabled(report, "diary", true, disabled.siteConfigVersion);
    const second = await readConfig(report, "siteConfig");
    expect(second.overrideValue).toEqual({ featurePages: { diary: true, friends: false } });
    expect(await readFile(path.join(root, "src/config/siteConfig.ts"), "utf8")).toBe(source);
    const override =
      '// keep override\nexport default { title: "Override", featurePages: { friends: false, diary: true, customPage: false } };\n';
    await writeFile(path.join(contentRoot, "overrides/siteConfig.ts"), override);
    const current = await readConfig(report, "siteConfig");
    await setFeatureEnabled(report, "friends", true, current.version);
    expect(await readFile(path.join(contentRoot, "overrides/siteConfig.ts"), "utf8")).toBe(
      override.replace("friends: false", "friends: true"),
    );
  });
});

it("rejects stale versions, readonly workspaces, arbitrary keys and pages without a switch", async () => {
  const { root, report, state } = await fixture("local");
  await withWorkspaceState(state, async () => {
    const before = await featureIndex(report);
    await expect(setFeatureEnabled(report, "friends", false, "stale")).rejects.toThrow(
      /其他位置修改/,
    );
    await expect(
      setFeatureEnabled({ ...report, readOnly: true }, "friends", false, before.siteConfigVersion),
    ).rejects.toThrow(/只读/);
    await expect(
      setFeatureEnabled({ ...report, mode: "blocked" }, "friends", false, before.siteConfigVersion),
    ).rejects.toThrow(/只读/);
    for (const key of ["about", "__proto__", "title", "../siteConfig"])
      await expect(setFeatureEnabled(report, key, false, before.siteConfigVersion)).rejects.toThrow(
        /未提供启用开关/,
      );
    expect(await listConfigBackups(report, "siteConfig")).toHaveLength(0);
    expect(await readFile(path.join(root, "src/config/siteConfig.ts"), "utf8")).toBe(source);
  });
});

it("handles missing nested fields and quoted keys, and refuses ambiguous objects", () => {
  for (const initializer of [
    "{}",
    "{ featurePages: {} }",
    '{ "featurePages": { "diary": true } }',
    "({ featurePages: {} } as const)",
  ]) {
    const patched = patchConfigBoolean(initializer, ["featurePages", "diary"], false);
    expect(patched).toContain("false");
  }
  expect(() =>
    patchConfigBoolean("{ featurePages: FLAGS }", ["featurePages", "diary"], false),
  ).toThrow(/对象字面量/);
  expect(() =>
    patchConfigBoolean("{ featurePages: {}, featurePages: {} }", ["featurePages", "diary"], false),
  ).toThrow(/字段重复/);
});
