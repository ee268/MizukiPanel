import { useCallback, useEffect, useState } from "react";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { FeatureTextDocument } from "../types";
import { LoadingPaper } from "./LoadingPaper";
import { useLiveProjectDocument } from "../workspace/WorkspaceSessionProvider";

export function TextEditor({
  resource,
  notify,
  fail,
}: {
  resource: string;
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [loadedDocument, setDocument] = useState<FeatureTextDocument | null>(null);
  const document = useLiveProjectDocument(loadedDocument);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await api<FeatureTextDocument>(`/api/feature/text?key=${resource}`);
      setDocument(data);
      setContent(data.content);
    } catch (cause) {
      fail(errorMessage(cause, "正文读取失败"));
    }
  }, [fail, resource]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save() {
    if (!document) return;
    setBusy(true);
    try {
      const result = await api<{ document: FeatureTextDocument; backupPath: string | null }>(
        "/api/feature/text",
        json("PUT", { key: resource, content, version: document.version }),
      );
      setDocument(result.document);
      setBackupPath(result.backupPath);
      notify("正文已保存。");
    } catch (cause) {
      fail(errorMessage(cause, "正文保存失败"));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!document || !backupPath) return;
    try {
      const result = await api<FeatureTextDocument>(
        "/api/feature/restore",
        json("POST", { kind: "text", key: resource, backupPath, version: document.version }),
      );
      setDocument(result);
      setContent(result.content);
      setBackupPath(null);
      notify("正文已恢复。");
    } catch (cause) {
      fail(errorMessage(cause, "恢复失败"));
    }
  }
  if (!document) return <LoadingPaper />;
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: "center" }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {document.label}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveOutlined />}
          onClick={save}
          disabled={busy || document.readOnly}
        >
          保存
        </Button>
        {backupPath && (
          <Button color="warning" startIcon={<RestoreOutlined />} onClick={restore}>
            撤销保存
          </Button>
        )}
      </Stack>
      <TextField
        value={content}
        onChange={(event) => setContent(event.target.value)}
        multiline
        minRows={28}
        fullWidth
        sx={{
          "& textarea": {
            fontFamily: "var(--mizuki-panel-font-mono)",
            fontSize: 13,
            lineHeight: 1.6,
          },
        }}
      />
    </Paper>
  );
}
