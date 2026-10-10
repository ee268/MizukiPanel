import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { FeatureTextDocument } from "../types";
import { LoadingPaper } from "./LoadingPaper";
import { useSessionRecovery, useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import { useLiveProjectDocument } from "../workspace/WorkspaceSessionProvider";
import { VditorBodyEditor, type VditorBodyEditorHandle } from "../articles/VditorBodyEditor";
import { useEditorFontMode } from "../articles/useEditorFontMode";
import { articleShortcut } from "../articles/editor-shortcuts";
import "../articles/editor-fonts.css";

export function TextEditor({
  resource,
  projectRoot,
  notify,
  fail,
}: {
  resource: string;
  projectRoot: string;
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [loadedDocument, setDocument] = useState<FeatureTextDocument | null>(null);
  const document = useLiveProjectDocument(loadedDocument);
  const [content, setContent] = useState("");
  const currentContent = useRef(content);
  currentContent.current = content;
  const editor = useRef<VditorBodyEditorHandle>(null);
  const fontMode = useEditorFontMode(projectRoot);
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  useSessionRecovery({
    label: "关于页编辑器输入",
    prepare: () => flushSync(() => editor.current?.flush(true)),
    save: async () => {},
    snapshot: () => null,
  });
  useUnsavedSessionRecovery("特色页正文", Boolean(document && content !== document.content), {
    kind: "featureText",
    key: resource,
    content,
    baseVersion: document?.version,
  });
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
    if (!document || document.readOnly || busy) return;
    flushSync(() => editor.current?.flush());
    const source = currentContent.current;
    setBusy(true);
    try {
      const result = await api<{ document: FeatureTextDocument; backupPath: string | null }>(
        "/api/feature/text",
        json("PUT", { key: resource, content: source, version: document.version }),
      );
      setDocument(result.document);
      setContent(result.document.content);
      setBackupPath(result.backupPath);
      notify("正文已保存。");
    } catch (cause) {
      fail(errorMessage(cause, "正文保存失败"));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!document || !backupPath || document.readOnly || busy) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }
  if (!document) return <LoadingPaper />;
  return (
    <Paper
      variant="outlined"
      onKeyDownCapture={(event) => {
        if (articleShortcut(event) !== "save" || document.readOnly || busy) return;
        event.preventDefault();
        void save();
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ px: 2.5, pt: 2.5, alignItems: "center" }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {document.label}
        </Typography>
        {backupPath && (
          <Button
            color="warning"
            startIcon={<RestoreOutlined />}
            onClick={restore}
            disabled={document.readOnly || busy}
          >
            撤销保存
          </Button>
        )}
      </Stack>
      <VditorBodyEditor
        key={`${projectRoot}:${resource}:${document.version}`}
        ref={editor}
        article={{ id: "about.md", version: document.version, format: "md" }}
        source={content}
        busy={busy}
        readOnly={document.readOnly}
        fontMode={fontMode}
        imageScope="public"
        ariaLabel="关于页 Markdown 正文"
        onChange={(source) => {
          currentContent.current = source;
          setContent(source);
        }}
        onSave={() => void save()}
      />
    </Paper>
  );
}
