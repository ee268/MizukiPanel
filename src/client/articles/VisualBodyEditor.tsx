import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import {
  replaceArticleSegments,
  segmentArticleSource,
  type SourceSegment,
} from "../../lib/articles/source-islands";
import type { ArticleRecord } from "../types";
import { preserveSegmentBoundary } from "./article-draft";

interface VisualBodyEditorProps {
  article: ArticleRecord;
  source: string;
  busy: boolean;
  readOnly: boolean;
  onChange: (source: string) => void;
  onSave: () => void;
  onSourceMode: () => void;
}

interface MarkdownSegmentProps {
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (markdown: string) => void;
}

function MarkdownSegment({ segment, readOnly, onChange }: MarkdownSegmentProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialValue = useRef(segment.raw);
  const { loading } = useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialValue.current);
          ctx.set(editorViewOptionsCtx, { editable: () => !readOnly });
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previous) => {
            if (markdown !== previous) {
              initialValue.current = markdown;
              onChangeRef.current(markdown);
            }
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(listener),
    [readOnly],
  );

  return (
    <Box
      sx={{
        "& .milkdown .editor": {
          minHeight: 56,
          outline: "none",
          fontSize: "1rem",
          lineHeight: 1.85,
          color: "text.primary",
          overflowWrap: "anywhere",
        },
        "& .milkdown .editor > :first-of-type": { mt: 0 },
        "& .milkdown .editor > :last-child": { mb: 0 },
        "& .milkdown h1, & .milkdown h2, & .milkdown h3": { lineHeight: 1.35 },
        "& .milkdown h1": { fontSize: "2rem" },
        "& .milkdown h2": { fontSize: "1.6rem" },
        "& .milkdown h3": { fontSize: "1.3rem" },
        "& .milkdown blockquote": {
          borderLeft: "3px solid",
          borderColor: "primary.main",
          pl: 2,
          ml: 0,
          color: "text.secondary",
        },
        "& .milkdown pre": {
          p: 2,
          borderRadius: 1,
          overflowX: "auto",
          backgroundColor: "action.hover",
        },
        "& .milkdown code": { fontFamily: "monospace" },
        "& .milkdown img": { maxWidth: "100%" },
        "& .milkdown table": { borderCollapse: "collapse", display: "block", overflowX: "auto" },
        "& .milkdown td, & .milkdown th": {
          border: "1px solid",
          borderColor: "divider",
          px: 1.5,
          py: 0.75,
        },
      }}
    >
      {loading && <Typography color="text.secondary">正在加载编辑器…</Typography>}
      <Milkdown />
    </Box>
  );
}

export function VisualBodyEditor({
  article,
  source,
  busy,
  readOnly,
  onChange,
  onSave,
  onSourceMode,
}: VisualBodyEditorProps) {
  const [snapshot] = useState(() => segmentArticleSource(source, article.format));
  const replacements = useRef(new Map<number, string>());

  function updateSegment(segment: SourceSegment, markdown: string) {
    const leftInline = segment.start > 0 && !/[\r\n]/.test(snapshot.body[segment.start - 1]);
    const rightInline =
      segment.end < snapshot.body.length && !/[\r\n]/.test(snapshot.body[segment.end]);
    const replacement = preserveSegmentBoundary(segment.raw, markdown, leftInline, rightInline);
    if (replacement === segment.raw) {
      replacements.current.delete(segment.id);
    } else {
      replacements.current.set(segment.id, replacement);
    }
    onChange(replaceArticleSegments(snapshot, replacements.current));
  }

  if (snapshot.mode === "source") {
    return (
      <Alert severity="warning" sx={{ m: 3 }}>
        无法安全分段正文：{snapshot.reason}。请使用
        <Button size="small" onClick={onSourceMode}>
          完整源码
        </Button>
        编辑。
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Alert severity="info">
        普通 Markdown 可直接编辑。Mizuki 扩展语法与 MDX 暂以原文卡片保护；编辑它们请切换完整源码。
      </Alert>
      <Paper variant="outlined" inert={busy} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5}>
          {snapshot.segments.map((segment) =>
            segment.mode === "editable" ? (
              <MilkdownProvider key={segment.id}>
                <MarkdownSegment
                  segment={segment}
                  readOnly={readOnly}
                  onChange={(markdown) => updateSegment(segment, markdown)}
                />
              </MilkdownProvider>
            ) : (
              <Paper
                key={segment.id}
                variant="outlined"
                sx={{ p: 1.5, backgroundColor: "action.hover" }}
              >
                <Chip size="small" label={segment.syntax ?? "源码片段"} sx={{ mb: 1 }} />
                <Typography
                  component="pre"
                  sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}
                >
                  {segment.raw}
                </Typography>
              </Paper>
            ),
          )}
        </Stack>
      </Paper>
      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<SaveOutlined />}
          onClick={onSave}
          disabled={busy || readOnly}
        >
          保存正文
        </Button>
      </Stack>
    </Stack>
  );
}
