import { useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { ContentLoading } from "../components/ContentLoading";
import { VditorBodyEditor } from "../articles/VditorBodyEditor";
import { useEditorFontMode } from "../articles/useEditorFontMode";
import type { ArticleRecord } from "../types";
const previewSource =
  '# 字体与编辑预览\n\n调整设置，查看正文、**加粗**、[链接](https://example.com)和 `行内代码` 的效果。\n\n## 代码与大纲\n\n```js\nfunction example() {\n\treturn "制表宽度只影响显示";\n}\n```\n';
export default function EditorPreview({ projectRoot }: { projectRoot: string }) {
  const [source, setSource] = useState(previewSource);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const fontMode = useEditorFontMode(projectRoot);
  const article = {
    id: "settings-editor-preview.md",
    version: String(version),
    format: "md",
    source,
  } as ArticleRecord;
  return (
    <Paper variant="outlined" component="section" aria-label="编辑预览" sx={{ minWidth: 0 }}>
      <Stack spacing={1} sx={{ p: 3 }}>
        <Typography variant="h6" component="h3">
          编辑预览
        </Typography>
        <Typography variant="body2" color="text.secondary">
          可以试写；预览内容不会保存为文章。显示选项即时生效，默认模式需要重新打开预览后查看。
        </Typography>
        <Button
          sx={{ alignSelf: "flex-start" }}
          onClick={() => {
            setReady(false);
            setVersion((value) => value + 1);
          }}
        >
          重新打开预览
        </Button>
      </Stack>
      <Box sx={{ position: "relative" }}>
        {!ready && (
          <ContentLoading
            heading="正在展开编辑预览"
            description="正在准备内容与编辑区域"
            size="compact"
          />
        )}
        <Box
          inert={!ready}
          aria-hidden={!ready || undefined}
          sx={
            ready
              ? undefined
              : { position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }
          }
        >
          <VditorBodyEditor
            onLoadEnd={() => setReady(true)}
            article={article}
            source={source}
            fontMode={fontMode}
            busy={false}
            readOnly={false}
            showSave={false}
            onChange={setSource}
            onSave={() => {}}
          />
        </Box>
      </Box>
    </Paper>
  );
}
