import { normalizeLooseStrong } from "../../lib/articles/loose-strong";

type Parser = (...args: string[]) => string;
interface LuteFactory {
  New: () => object;
}
const configured = new WeakSet<LuteFactory>();

/** Adapt parser inputs only; placeholders never reach the editable DOM or saved Markdown. */
function compatibleInput(input: string, html: boolean) {
  const { normalized, markers } = normalizeLooseStrong(input);
  let value = normalized;
  if (markers.size) {
    // Destinations contain structural parentheses, not emphasis text. Keep them byte-for-byte.
    for (const opening of input.matchAll(/\]\(/g)) {
      const start = opening.index + 2;
      let end = start;
      let depth = 1;
      for (; end < input.length && depth && input[end] !== "\n"; end++) {
        if (input[end] === "\\") end++;
        else if (input[end] === "(") depth++;
        else if (input[end] === ")") depth--;
      }
      value = value.slice(0, start) + input.slice(start, end) + value.slice(end);
    }
    for (const pattern of [
      /<[^>\n]*>/g,
      /https?:\/\/[^\s<>]+/g,
      /^ {0,3}\[[^\n]+\]:[^\n]*/gm,
      /(`+)[\s\S]*?\1/g,
    ]) {
      for (const match of input.matchAll(pattern)) {
        value = value.slice(0, match.index) + match[0] + value.slice(match.index + match[0].length);
      }
    }
    for (const match of input.matchAll(/\*\*[^*\r\n]*\*\*/g)) {
      let escapes = 0;
      for (let index = match.index - 1; index >= 0 && input[index] === "\\"; index--) escapes++;
      if (escapes % 2) {
        value = value.slice(0, match.index) + match[0] + value.slice(match.index + match[0].length);
      }
    }
  }
  if (html) {
    let next = 0xe000;
    const substitutions = new Map(
      [...markers].map(([marker, punctuation]) => [punctuation, marker]),
    );
    value = value.replace(
      /<(strong|b|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
      (element, tag: string, attributes: string, content: string) => {
        // SV stores bold text in spans; IR/WYSIWYG store it in strong elements.
        if (tag.toLowerCase() === "span" && !/\bclass=["'][^"']*\bstrong\b/.test(attributes))
          return element;
        const ending = /([)\]}!?.,;:，。！？、])((?:‸|<wbr\s*\/?>|<\/[^>]+>)*)$/u;
        const match = content.match(ending);
        if (!match) return element;
        let marker = substitutions.get(match[1]);
        if (!marker) {
          while (
            next <= 0xf8ff &&
            (value.includes(String.fromCharCode(next)) || markers.has(String.fromCharCode(next)))
          )
            next++;
          if (next > 0xf8ff) return element;
          marker = String.fromCharCode(next++);
          markers.set(marker, match[1]);
          substitutions.set(match[1], marker);
        }
        return `<${tag}${attributes}>${content.replace(ending, marker + "$2")}</${tag}>`;
      },
    );
  }
  return {
    value,
    restore(result: string) {
      for (const [marker, punctuation] of markers) {
        result = result.replaceAll(marker, punctuation);
      }
      return result;
    },
  };
}

/** Vditor creates separate Lute instances for the editor, split preview and outline. */
export function configureVditorStrong(factory: LuteFactory): void {
  if (configured.has(factory)) return;
  configured.add(factory);
  const create = factory.New;
  factory.New = function () {
    const lute = create.call(factory) as Record<string, unknown>;
    for (const name of [
      "Md2HTML",
      "MarkdownStr",
      "Md2VditorDOM",
      "Md2VditorIRDOM",
      "Md2VditorSVDOM",
      "SpinVditorDOM",
      "SpinVditorIRDOM",
      "SpinVditorSVDOM",
      "HTML2VditorDOM",
      "HTML2VditorIRDOM",
      "HTML2VditorSVDOM",
      "VditorDOM2HTML",
      "VditorIRDOM2HTML",
    ]) {
      const parse = lute[name] as Parser;
      if (typeof parse !== "function") continue;
      lute[name] = function (...args: string[]) {
        const index = name === "MarkdownStr" ? 1 : 0;
        const input = compatibleInput(
          args[index],
          !name.startsWith("Md") && name !== "MarkdownStr",
        );
        args[index] = input.value;
        return input.restore(parse.apply(lute, args));
      };
    }
    return lute;
  };
}
