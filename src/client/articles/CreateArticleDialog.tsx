import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, json } from "../api";
import { useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import { defaultArticleFrontmatter } from "../../shared/panel-settings/article-template";
import { useEditorFontMode } from "./useEditorFontMode";
import { useArticleFonts } from "./useArticleFonts";
import {
  localDate,
  type CreationDefaults,
  type CreationFields,
  type CreationPreview,
} from "./creation-types";
export function CreateArticleDialog({
  open,
  busy,
  readOnly,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  readOnly: boolean;
  onClose: () => void;
  onCreate: (fields: CreationFields, preview: CreationPreview) => Promise<void>;
}) {
  const [defaults, setDefaults] = useState<CreationDefaults | null>(null);
  const fonts = useArticleFonts(useEditorFontMode(defaults?.projectKey ?? ""));
  const [preview, setPreview] = useState<CreationPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<CreationFields>({
    id: "",
    title: "",
    published: localDate(),
    draft: true,
    body: "# 开始写作",
    frontmatter: defaultArticleFrontmatter,
  });
  const [refresh, setRefresh] = useState(0);
  const epoch = useRef(0);
  useUnsavedSessionRecovery(
    "新文章表单",
    Boolean(
      open &&
      (fields.title ||
        fields.id ||
        fields.published !== localDate() ||
        !fields.draft ||
        fields.body !== (defaults?.values.body ?? "# 开始写作") ||
        fields.frontmatter !== (defaults?.values.frontmatter ?? defaultArticleFrontmatter)),
    ),
    { kind: "articleCreation", fields },
  );
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setDefaults(null);
    setPreview(null);
    setError("");
    setLoading(true);
    void api<CreationDefaults>("/api/articles/template", { signal: abort.signal })
      .then((value) => {
        if (abort.signal.aborted) return;
        setDefaults(value);
        setFields({
          id: "",
          title: "",
          published: localDate(),
          draft: true,
          body: value.values.body,
          frontmatter: value.values.frontmatter,
        });
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [open]);
  useEffect(() => {
    if (!open || !defaults) return;
    const request = ++epoch.current;
    setPreview(null);
    if (!fields.title.trim()) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void api<CreationPreview>("/api/articles/preview", {
        ...json("POST", {
          ...fields,
          projectKey: defaults.projectKey,
          settingsVersion: defaults.settingsVersion,
        }),
        signal: abort.signal,
      })
        .then((value) => {
          if (request === epoch.current && !abort.signal.aborted) {
            setPreview(value);
            setError("");
          }
        })
        .catch((cause) => {
          if (!abort.signal.aborted && request === epoch.current) setError(cause.message);
        })
        .finally(() => {
          if (request === epoch.current && !abort.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [open, defaults, fields, refresh]);
  async function refreshBase() {
    try {
      const latest = await api<CreationDefaults>("/api/articles/template");
      if (defaults && latest.projectKey !== defaults.projectKey)
        throw new Error("当前项目已切换，请关闭后重新打开创建窗口。当前输入保留。");
      setDefaults(latest);
      if (!defaults)
        setFields((current) => ({
          ...current,
          body: latest.values.body,
          frontmatter: latest.values.frontmatter,
        }));
      setRefresh((value) => value + 1);
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  const change = (patch: Partial<CreationFields>) => {
    setPreview(null);
    setFields((current) => ({ ...current, ...patch }));
  };
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (preview)
            void onCreate(fields, preview).catch((cause) => setError((cause as Error).message));
        }}
      >
        <DialogTitle>新建文章</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && (
              <Alert
                severity="error"
                action={<Button onClick={() => void refreshBase()}>更新预览基准</Button>}
              >
                {error}
              </Alert>
            )}
            {defaults?.warnings.map((warning) => (
              <Alert key={warning} severity="warning">
                {warning}
              </Alert>
            ))}
            <TextField
              label="文章文件路径"
              value={fields.id}
              onChange={(event) => change({ id: event.target.value })}
              placeholder={defaults?.values.fileName || "notes/my-post.md"}
              helperText={
                defaults?.values.fileName
                  ? "留空使用项目命名规则，也可手动指定。"
                  : "请手动指定 .md 或 .mdx 路径。"
              }
              disabled={busy || !defaults}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="标题"
                required
                fullWidth
                value={fields.title}
                onChange={(event) => change({ title: event.target.value })}
                disabled={busy || !defaults}
              />
              <TextField
                label="发布日期"
                required
                fullWidth
                value={fields.published}
                onChange={(event) => change({ published: event.target.value })}
                disabled={busy || !defaults}
              />
            </Stack>
            <TextField
              label="正文（Markdown 或 MDX）"
              multiline
              minRows={6}
              value={fields.body}
              onChange={(event) => change({ body: event.target.value })}
              disabled={busy || !defaults}
              slotProps={{ input: { sx: { fontFamily: fonts.code } } }}
            />
            <TextField
              label="默认字段（YAML）"
              multiline
              minRows={3}
              value={fields.frontmatter}
              onChange={(event) => change({ frontmatter: event.target.value })}
              disabled={busy || !defaults}
              helperText="来自项目模板，可在本次创建时调整；title、published 与 draft 以表单为准，{{today}} 使用当前系统日期。"
              slotProps={{ input: { sx: { fontFamily: fonts.code } } }}
            />
            <FormControlLabel
              label="先保存为草稿"
              control={
                <Checkbox
                  checked={fields.draft}
                  onChange={(_, draft) => change({ draft })}
                  disabled={busy || !defaults}
                />
              }
            />
            {preview && (
              <>
                <Typography variant="body2">
                  将创建：{preview.id} · {preview.previewPath}
                </Typography>
                <TextField
                  label="最终文件内容预览"
                  fullWidth
                  multiline
                  minRows={6}
                  value={preview.source}
                  slotProps={{
                    input: { readOnly: true, sx: { fontFamily: fonts.code } },
                  }}
                />
              </>
            )}
            {loading && (
              <Typography variant="body2" color="text.secondary">
                正在读取默认值或校验预览…
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || loading || !preview || readOnly}
          >
            创建
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
