import { useMemo } from "react";
import { parseCodeGroup } from "../../lib/articles/code-groups";
import { parseFencedCode } from "../../lib/articles/fenced-code";
import { parseGithubAlert } from "../../lib/articles/github-alerts";
import { parseInlineExtension } from "../../lib/articles/inline-extensions";
import { parseMathFragment } from "../../lib/articles/math-fragments";
import { parseMdxComponent } from "../../lib/articles/mdx-components";
import { parseMizukiDirective } from "../../lib/articles/mizuki-directives";
import { parseHtmlImages } from "../../lib/articles/html-images";
import type { SegmentedArticle, SourceSegment } from "../../lib/articles/source-islands";
import { CodeBlockCard } from "./CodeBlockCard";
import { CodeGroupCard } from "./CodeGroupCard";
import { DirectiveBlock } from "./DirectiveBlock";
import { GithubAlertBlock } from "./GithubAlertBlock";
import { HtmlImageCard } from "./HtmlImageCard";
import { InlineExtensionCard } from "./InlineExtensionCard";
import { LiteralSourceEditor } from "./LiteralSourceEditor";
import { MathBlock } from "./MathBlock";
import { MdxComponentCard } from "./MdxComponentCard";
import { QuotedHtmlImageBlock } from "./QuotedHtmlImageBlock";

interface SourceSegmentEditorProps {
  articleId: string;
  article: SegmentedArticle;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function SourceSegmentEditor({
  articleId,
  article,
  segment,
  readOnly,
  onChange,
  onValidityChange,
}: SourceSegmentEditorProps) {
  const parsed = useMemo(() => {
    const raw = segment.raw;
    return {
      directive: parseMizukiDirective(raw),
      inline:
        segment.syntax === "wikiLink" || segment.syntax === "textDirective"
          ? parseInlineExtension(raw)
          : null,
      alert: segment.syntax === "githubAdmonition" ? parseGithubAlert(raw) : null,
      math:
        segment.syntax === "math" || segment.syntax === "inlineMath"
          ? parseMathFragment(raw)
          : null,
      code: segment.syntax?.startsWith("code:") ? parseFencedCode(raw) : null,
      group: segment.syntax === "codeGroup" ? parseCodeGroup(raw) : null,
      component: parseMdxComponent(segment),
    };
  }, [segment.raw, segment.syntax]);

  if (parsed.directive) {
    return (
      <DirectiveBlock
        articleId={articleId}
        directive={parsed.directive}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }
  if (parsed.inline) {
    return (
      <InlineExtensionCard
        extension={parsed.inline}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }
  if (parsed.alert) {
    return (
      <GithubAlertBlock
        alert={parsed.alert}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }
  if (parsed.math) {
    return (
      <MathBlock
        fragment={parsed.math}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }
  if (parsed.code) {
    return (
      <CodeBlockCard
        block={parsed.code}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }
  if (parsed.group) {
    return (
      <CodeGroupCard
        group={parsed.group}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }

  if (segment.syntax === "htmlImageQuote") {
    return (
      <QuotedHtmlImageBlock
        articleId={articleId}
        segment={segment}
        readOnly={readOnly}
        onChange={onChange}
      />
    );
  }

  if (parseHtmlImages(segment.raw) || /^\s*<img\b/i.test(segment.raw)) {
    return (
      <HtmlImageCard
        articleId={articleId}
        segment={segment}
        readOnly={readOnly}
        onChange={onChange}
      />
    );
  }

  if (parsed.component) {
    return (
      <MdxComponentCard
        article={article}
        segment={segment}
        component={parsed.component}
        readOnly={readOnly}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    );
  }

  return <LiteralSourceEditor segment={segment} readOnly={readOnly} onChange={onChange} />;
}
