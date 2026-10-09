import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { expandTemplate } from "../../shared/panel-settings/article-template";
import { api, json } from "../api";
import { localDate, type CreationPreview } from "../articles/creation-types";
import type { useProjectTemplate } from "./useProjectTemplate";
export function ProjectTemplateForm({
  controller,
  onRefresh,
}: {
  controller: ReturnType<typeof useProjectTemplate>;
  onRefresh: () => void;
}) {
  const [preview, setPreview] = useState<CreationPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const previewRevision = useRef(0);
  const { base, value } = controller;
  useEffect(() => {
    previewRevision.current += 1;
    setPreview(null);
    setPreviewError("");
  }, [base?.key, base?.settings.version, value]);
  const disabled = !base || base.settings.readOnly || controller.saving;
  async function showPreview() {
    if (!base) return;
    const request = ++previewRevision.current;
    setPreviewError("");
    setPreview(null);
    try {
      const date = localDate();
      const [year, month, day] = date.split("-");
      const id = value.fileName
        ? expandTemplate(value.fileName, {
            title: "示例文章",
            slug: "示例文章",
            date,
            year,
            month,
            day,
          })
        : "example.md";
      const result = await api<CreationPreview>(
        "/api/articles/preview",
        json("POST", {
          id,
          title: "示例文章",
          published: date,
          draft: true,
          body: value.body,
          frontmatter: value.frontmatter,
          projectKey: base.articleKey,
          settingsVersion: base.settings.version,
        }),
      );
      if (request === previewRevision.current) setPreview(result);
    } catch (cause) {
      if (request === previewRevision.current)
        setPreviewError(cause instanceof Error ? cause.message : "模板预览失败。");
    }
  }
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label="新文章模板"
      sx={{ p: { xs: 2.5, sm: 3 } }}
    >
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
          <Typography component="h3" variant="h6">
            新文章模板
          </Typography>
          <Chip size="small" label={base ? `当前项目 · ${base.name}` : "未连接项目"} />
          {controller.dirty && <Chip size="small" color="warning" label="未保存" />}
        </Stack>
        {!base && (
          <Alert severity="info">
            连接项目后可设置模板；浏览器显示偏好和本地草稿设置仍可使用。
          </Alert>
        )}
        {controller.conflict && (
          <Alert
            severity="warning"
            action={<Button onClick={() => controller.reset()}>重新载入</Button>}
          >
            当前项目或模板版本已变化，旧输入保留。请重新载入后保存。
          </Alert>
        )}
        {controller.error && <Alert severity="error">{controller.error}</Alert>}
        <Button sx={{ alignSelf: "flex-start" }} onClick={onRefresh}>
          读取最新模板
        </Button>
        <TextField
          label="模板正文"
          multiline
          minRows={5}
          fullWidth
          disabled={disabled}
          value={value.body}
          onChange={(event) => {
            controller.change({ body: event.target.value });
            setPreview(null);
          }}
          helperText="只影响新建文章；现有文章不会改变。"
        />
        <TextField
          label="默认 Frontmatter（YAML）"
          multiline
          minRows={4}
          fullWidth
          disabled={disabled}
          value={value.frontmatter}
          onChange={(event) => {
            controller.change({ frontmatter: event.target.value });
            setPreview(null);
          }}
          placeholder={'title: "{{title}}"\npublished: "{{date}}"\ntags: [笔记]'}
          helperText="Mizuki 必填字段为 title 和 published，默认模板使用标题和日期占位符；创建时以表单输入为准，draft 由草稿开关生成。支持其他 YAML 字段。"
        />
        <TextField
          label="文件名规则"
          fullWidth
          disabled={disabled}
          value={value.fileName}
          onChange={(event) => {
            controller.change({ fileName: event.target.value });
            setPreview(null);
          }}
          placeholder="notes/{{date}}-{{slug}}.md"
          helperText="留空时手动指定路径；仅支持 .md/.mdx，相对于 posts。创建前会检查重名和 URL 冲突。"
        />
        <Typography variant="body2" color="text.secondary">
          可用占位符：{"{{title}}、{{date}}、{{year}}、{{month}}、{{day}}、{{slug}}"}
          。示例预览使用“示例文章”和当前日期；新建时可调整生成结果。
        </Typography>
        <Button
          sx={{ alignSelf: "flex-start" }}
          disabled={disabled || controller.conflict}
          onClick={() => void showPreview()}
        >
          预览新建结果
        </Button>
        {previewError && <Alert severity="warning">{previewError}</Alert>}
        {preview && (
          <Box>
            <Typography variant="body2">
              目标：{preview.id} · {preview.previewPath}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              value={preview.source}
              label="生成内容"
              slotProps={{
                input: { readOnly: true, sx: { fontFamily: "var(--mizuki-panel-font-mono)" } },
              }}
              sx={{ mt: 2 }}
            />
          </Box>
        )}
        <Divider />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Button
            variant="contained"
            disabled={disabled || !controller.dirty || controller.conflict}
            onClick={() => void controller.save()}
          >
            保存模板
          </Button>
          <Button
            disabled={!controller.dirty || controller.saving}
            onClick={() => {
              controller.reset();
              setPreview(null);
            }}
          >
            取消修改
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              controller.reset(true);
              setPreview(null);
            }}
          >
            恢复本组默认
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
