import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { beforeAll, expect, it } from "vitest";

interface Dependency {
  specifier: string;
  runtime: boolean;
}
const sourceRoot = path.resolve("src");
const dependencies = new Map<string, Dependency[]>();
const relative = (file: string) => path.relative(sourceRoot, file).replaceAll("\\", "/");

beforeAll(async () => {
  async function scan(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (/\.tsx?$/.test(entry.name)) {
        const source = ts.createSourceFile(
          file,
          await readFile(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        const imports: Dependency[] = [];
        function visit(node: ts.Node) {
          if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const clause = ts.isImportDeclaration(node) ? node.importClause : node;
            const bindings = ts.isImportDeclaration(node)
              ? node.importClause?.namedBindings
              : node.exportClause;
            const allTypes =
              bindings &&
              (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
              bindings.elements.length > 0 &&
              bindings.elements.every((item) => item.isTypeOnly);
            imports.push({
              specifier: node.moduleSpecifier.text,
              runtime:
                !clause?.isTypeOnly &&
                !(allTypes && !(ts.isImportDeclaration(node) && node.importClause?.name)),
            });
          } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
          ) {
            imports.push({ specifier: node.arguments[0].text, runtime: true });
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
        dependencies.set(file, imports);
      }
    }
  }
  await scan(sourceRoot);
});

function target(file: string, specifier: string) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(file), specifier);
  return (
    [
      base,
      base + ".ts",
      base + ".tsx",
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ].find((candidate) => dependencies.has(candidate)) ?? null
  );
}

it("keeps browser, shared contracts, and server dependencies in their own layers", () => {
  const violations: string[] = [];
  for (const [file, imports] of dependencies) {
    const owner = relative(file);
    for (const { specifier } of imports) {
      const resolved = target(file, specifier);
      const destination = resolved ? relative(resolved) : specifier;
      const forbidden = owner.startsWith("client/")
        ? /^(?:lib\/server\/|server\/|node:)/.test(destination)
        : owner.startsWith("shared/")
          ? /^(?:client\/|lib\/server\/|server\/|node:|react(?:$|\/)|@mui\/)/.test(destination)
          : owner.startsWith("lib/server/") || owner.startsWith("server/")
            ? destination.startsWith("client/")
            : false;
      if (forbidden) violations.push(`${owner} → ${destination}`);
    }
  }
  expect(violations).toEqual([]);
});

it("keeps feature and publishing domain modules free of runtime dependency cycles", () => {
  const cycles = new Set<string>();
  function walk(file: string, active: string[], completed: Set<string>) {
    const at = active.indexOf(file);
    if (at >= 0) {
      cycles.add([...active.slice(at), file].map(relative).join(" → "));
      return;
    }
    if (completed.has(file)) return;
    for (const dependency of dependencies.get(file) ?? []) {
      const resolved = dependency.runtime ? target(file, dependency.specifier) : null;
      if (resolved) walk(resolved, [...active, file], completed);
    }
    completed.add(file);
  }
  for (const file of dependencies.keys()) {
    if (/^lib\/server\/(?:features|publish)\//.test(relative(file))) walk(file, [], new Set());
  }
  expect([...cycles]).toEqual([]);
});
