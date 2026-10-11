import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  defaultBangumiNetworkSettings,
  validBangumiBaseUrl,
  type BangumiProjectBaseUrl,
} from "../../shared/bangumi-settings";
import { assertManagedRealPath } from "./path-guard";

// Read the quarterly renderer's constant without running project JavaScript.
export function projectBangumiBaseUrl(source: string): string | null {
  const file = ts.createSourceFile(
    "bgm-card.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (
    (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length
  )
    return null;
  const candidates: (string | null)[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "BGM_BASE_URL"
    ) {
      const value = node.initializer;
      candidates.push(
        value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
          ? value.text
          : null,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (candidates.length !== 1 || !validBangumiBaseUrl(candidates[0])) return null;
  const url = new URL(candidates[0]!.trim());
  url.pathname = url.pathname.replace(/\/v0\/subjects\/?$/, "").replace(/\/+$/, "") || "/";
  return url.href.replace(/\/$/, "");
}

export async function readProjectBangumiBaseUrl(root?: string): Promise<BangumiProjectBaseUrl> {
  const fallback = { baseUrl: defaultBangumiNetworkSettings.baseUrl, source: "fallback" as const };
  if (!root) return { ...fallback, warning: "当前未连接项目，暂使用 Bangumi 官方地址。" };
  try {
    const target = await assertManagedRealPath(root, "public/js/bgm-card.js");
    const source = await readFile(target, "utf8");
    const baseUrl = projectBangumiBaseUrl(source);
    if (baseUrl) return { baseUrl, source: "project" };
  } catch {
    // Missing, inaccessible or external scripts cannot supply a trusted default.
  }
  return {
    ...fallback,
    warning: "未能读取季度追番的 BGM_BASE_URL，暂使用 Bangumi 官方地址；可直接修改输入框中的地址。",
  };
}
