import ts from 'typescript';

export type ConfigValue = null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };

export class ConfigValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ConfigValidationError'; }
}

interface LocatedInitializer {
  node: ts.Expression;
  sourceFile: ts.SourceFile;
}

function sourceFile(source: string): ts.SourceFile {
  const file = ts.createSourceFile('config.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (diagnostics.length) throw new ConfigValidationError('TypeScript 语法无效：' + ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'));
  return file;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current)) current = current.expression;
  return current;
}

function locate(source: string, exportName: string | null): LocatedInitializer {
  const file = sourceFile(source);
  if (exportName === null) {
    for (const statement of file.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) return { node: statement.expression, sourceFile: file };
    }
    throw new ConfigValidationError('覆盖文件必须包含 export default 对象');
  }
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer)
        return { node: declaration.initializer, sourceFile: file };
    }
  }
  throw new ConfigValidationError(`找不到导出配置 ${exportName}`);
}

function propertyName(node: ts.PropertyName, file: ts.SourceFile): string {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  throw new ConfigValidationError(`不支持计算属性名：${node.getText(file)}`);
}

function constants(file: ts.SourceFile): Map<string, ts.Expression> {
  const result = new Map<string, ts.Expression>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) result.set(declaration.name.text, declaration.initializer);
    }
  }
  return result;
}

function evaluate(node: ts.Expression, file: ts.SourceFile, known: Map<string, ts.Expression>, stack = new Set<string>()): ConfigValue {
  const value = unwrap(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (ts.isNumericLiteral(value)) return Number(value.text);
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (value.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand)) {
    const number = Number(value.operand.text);
    if (value.operator === ts.SyntaxKind.MinusToken) return -number;
    if (value.operator === ts.SyntaxKind.PlusToken) return number;
  }
  if (ts.isIdentifier(value)) {
    if (value.text === 'undefined') return '«expression: undefined»';
    const resolved = known.get(value.text);
    if (resolved && !stack.has(value.text)) {
      const next = new Set(stack); next.add(value.text);
      return evaluate(resolved, file, known, next);
    }
    return `«expression: ${value.getText(file)}»`;
  }
  if (ts.isPropertyAccessExpression(value)) return `«expression: ${value.getText(file)}»`;
  if (ts.isArrayLiteralExpression(value)) return value.elements.map((item) => {
    if (ts.isSpreadElement(item)) return `«expression: ${item.getText(file)}»`;
    return evaluate(item, file, known, stack);
  });
  if (ts.isObjectLiteralExpression(value)) {
    const result: Record<string, ConfigValue> = {};
    for (const property of value.properties) {
      if (ts.isPropertyAssignment(property)) result[propertyName(property.name, file)] = evaluate(property.initializer, file, known, stack);
      else if (ts.isShorthandPropertyAssignment(property)) result[property.name.text] = evaluate(property.name, file, known, stack);
      else if (ts.isSpreadAssignment(property)) result[`«${property.getText(file)}»`] = `«expression: ${property.expression.getText(file)}»`;
      else throw new ConfigValidationError(`不支持的配置属性：${property.getText(file)}`);
    }
    return result;
  }
  return `«expression: ${value.getText(file)}»`;
}

function availableIdentifiers(file: ts.SourceFile): Set<string> {
  const result = new Set<string>(['undefined']);
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      if (statement.importClause.name) result.add(statement.importClause.name.text);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) result.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) result.add(element.name.text);
    }
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name)) result.add(declaration.name.text);
  }
  return result;
}

function assertSafe(node: ts.Expression, file: ts.SourceFile, allowed: Set<string>): void {
  const value = unwrap(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) || ts.isNumericLiteral(value)
    || value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword || value.kind === ts.SyntaxKind.NullKeyword) return;
  if (ts.isIdentifier(value)) {
    if (!allowed.has(value.text)) throw new ConfigValidationError(`配置引用了未声明的标识符：${value.text}`);
    return;
  }
  if (ts.isPropertyAccessExpression(value)) { assertSafe(value.expression, file, allowed); return; }
  if (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand)
    && (value.operator === ts.SyntaxKind.MinusToken || value.operator === ts.SyntaxKind.PlusToken)) return;
  if (ts.isArrayLiteralExpression(value)) {
    for (const element of value.elements) {
      if (ts.isSpreadElement(element)) throw new ConfigValidationError(`数组展开表达式暂不支持写入：${element.getText(file)}`);
      assertSafe(element, file, allowed);
    }
    return;
  }
  if (ts.isObjectLiteralExpression(value)) {
    for (const property of value.properties) {
      if (ts.isPropertyAssignment(property)) { propertyName(property.name, file); assertSafe(property.initializer, file, allowed); }
      else if (ts.isShorthandPropertyAssignment(property)) {
        if (!allowed.has(property.name.text)) throw new ConfigValidationError(`配置引用了未声明的标识符：${property.name.text}`);
      }
      else throw new ConfigValidationError(`复杂配置表达式暂不支持结构化写入：${property.getText(file)}`);
    }
    return;
  }
  throw new ConfigValidationError(`配置包含不可安全执行的表达式：${value.getText(file)}`);
}

export function parseConfigInitializer(source: string, exportName: string | null) {
  const located = locate(source, exportName);
  const node = unwrap(located.node);
  if (!ts.isObjectLiteralExpression(node)) throw new ConfigValidationError('配置导出必须是对象字面量');
  return {
    initializer: located.node.getText(located.sourceFile),
    value: evaluate(located.node, located.sourceFile, constants(located.sourceFile))
  };
}

function parseEditedInitializer(initializer: string, allowed = new Set<string>(['undefined'])): ts.Expression {
  const wrapper = sourceFile(`const __value = (${initializer});`);
  const statement = wrapper.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) throw new ConfigValidationError('配置内容无法解析');
  const expression = statement.declarationList.declarations[0]?.initializer;
  if (!expression) throw new ConfigValidationError('配置内容不能为空');
  const node = unwrap(expression);
  if (!ts.isObjectLiteralExpression(node)) throw new ConfigValidationError('配置内容必须是对象字面量');
  assertSafe(node, wrapper, allowed);
  return expression;
}

export function replaceConfigInitializer(source: string, exportName: string | null, initializer: string): string {
  const located = locate(source, exportName);
  parseEditedInitializer(initializer, availableIdentifiers(located.sourceFile));
  return source.slice(0, located.node.getStart(located.sourceFile)) + initializer.trim() + source.slice(located.node.getEnd());
}

export function createOverrideSource(initializer: string): string {
  const usesLinkPreset = /\bLinkPreset\s*\./.test(initializer);
  parseEditedInitializer(initializer, new Set(usesLinkPreset ? ['undefined', 'LinkPreset'] : ['undefined']));
  const importLine = usesLinkPreset ? 'import { LinkPreset } from "../../types/config";\n\n' : '';
  return `${importLine}export default ${initializer.trim()};\n`;
}

export function deepMergeConfig(base: ConfigValue, override: ConfigValue): ConfigValue {
  if (override === null) return null;
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== 'object' || typeof override !== 'object') return override;
  const result: Record<string, ConfigValue> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === '«expression: undefined»') continue;
    result[key] = key in result ? deepMergeConfig(result[key], value) : value;
  }
  return result;
}

export function changedConfigPaths(base: ConfigValue, effective: ConfigValue, prefix = ''): string[] {
  if (JSON.stringify(base) === JSON.stringify(effective)) return [];
  if (!Array.isArray(base) && !Array.isArray(effective) && base !== null && effective !== null
    && typeof base === 'object' && typeof effective === 'object') {
    const keys = new Set([...Object.keys(base), ...Object.keys(effective)]);
    return [...keys].flatMap((key) => changedConfigPaths(base[key] ?? null, effective[key] ?? null, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix || '(root)'];
}
