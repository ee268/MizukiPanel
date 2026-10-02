import { Chip, Paper, Typography } from "@mui/material";
import { useMemo } from "react";
import { parseCodeGroup } from "../../lib/articles/code-groups";
import { parseFencedCode } from "../../lib/articles/fenced-code";
import { parseGithubAlert } from "../../lib/articles/github-alerts";
import { parseInlineExtension } from "../../lib/articles/inline-extensions";
import { parseMathFragment } from "../../lib/articles/math-fragments";
import { parseMizukiDirective } from "../../lib/articles/mizuki-directives";
import type { SourceSegment } from "../../lib/articles/source-islands";
import { CodeBlockCard } from "./CodeBlockCard";
import { CodeGroupCard } from "./CodeGroupCard";
import { DirectiveBlock } from "./DirectiveBlock";
import { GithubAlertBlock } from "./GithubAlertBlock";
import { InlineExtensionCard } from "./InlineExtensionCard";
import { MathBlock } from "./MathBlock";

interface SourceSegmentEditorProps {
  articleId: string;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function SourceSegmentEditor({
  articleId,
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

  return (
    <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: "action.hover" }}>
      <Chip size="small" label={segment.syntax ?? "源码片段"} sx={{ mb: 1 }} />
      <Typography
        component="pre"
        sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}
      >
        {segment.raw}
      </Typography>
    </Paper>
  );
}
