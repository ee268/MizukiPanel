import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { yaml, yamlFrontmatter } from "@codemirror/lang-yaml";

const jsonSyntax = json();
const yamlSyntax = yaml();
const jsSyntax = javascript();
const tsSyntax = javascript({ typescript: true });
const markdownSyntax = yamlFrontmatter({
  content: markdown({
    base: markdownLanguage,
    codeLanguages: (info) => {
      switch (info.trim().split(/\s+/, 1)[0].toLowerCase()) {
        case "json":
          return jsonSyntax.language;
        case "yaml":
        case "yml":
          return yamlSyntax.language;
        case "js":
        case "javascript":
          return jsSyntax.language;
        case "ts":
        case "typescript":
          return tsSyntax.language;
        default:
          return null;
      }
    },
  }),
});

export const syntaxLanguages = { json: jsonSyntax, markdown: markdownSyntax, typescript: tsSyntax };
export type SyntaxLanguage = keyof typeof syntaxLanguages;
