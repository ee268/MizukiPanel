import { useCallback, useEffect, useRef, useState } from "react";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowDownwardOutlined from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlined from "@mui/icons-material/ArrowUpwardOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { ConfigValue, FeatureDataDocument } from "../types";
import { LoadingPaper } from "./LoadingPaper";
import { useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import { useLiveProjectDocument } from "../workspace/WorkspaceSessionProvider";
import { useFeaturePagination } from "./useFeaturePagination";
import { FeaturePagination } from "./FeaturePagination";
import { SyntaxEditor } from "../components/SyntaxEditor";

export function DataEditor({
  resource,
  notify,
  fail,
}: {
  resource: string;
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [loadedDocument, setDocument] = useState<FeatureDataDocument | null>(null);
  const document = useLiveProjectDocument(loadedDocument, Boolean(loadedDocument?.warnings.length));
  const [items, setItems] = useState<string[]>([]);
  const itemKeys = useRef<string[]>([]);
  const pagination = useFeaturePagination(items.length);
  const [objectText, setObjectText] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  useUnsavedSessionRecovery(
    "特色页数据",
    Boolean(
      document &&
      (Array.isArray(document.value)
        ? JSON.stringify(items) !==
          JSON.stringify(document.value.map((item) => JSON.stringify(item, null, 2)))
        : objectText !== JSON.stringify(document.value, null, 2)),
    ),
    { kind: "featureData", key: resource, items, objectText, baseVersion: document?.version },
  );
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api<FeatureDataDocument>(
        `/api/feature/data?key=${encodeURIComponent(resource)}`,
      );
      setDocument(data);
      setBackupPath(null);
      pagination.setPage(0);
      if (Array.isArray(data.value)) {
        itemKeys.current = data.value.map(() => crypto.randomUUID());
        setItems(data.value.map((item) => JSON.stringify(item, null, 2)));
      } else setObjectText(JSON.stringify(data.value, null, 2));
    } catch (cause) {
      fail(errorMessage(cause, "数据读取失败"));
    } finally {
      setBusy(false);
    }
  }, [fail, resource]);
  useEffect(() => {
    void load();
  }, [load]);
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    [itemKeys.current[index], itemKeys.current[target]] = [
      itemKeys.current[target],
      itemKeys.current[index],
    ];
    setItems((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    pagination.reveal(index + offset);
  }
  async function save() {
    if (!document) return;
    setBusy(true);
    try {
      const value =
        document.descriptor.shape === "array"
          ? items.map((item, index) => {
              try {
                return JSON.parse(item) as ConfigValue;
              } catch {
                pagination.reveal(index);
                throw new Error(`第 ${index + 1} 项不是有效 JSON`);
              }
            })
          : (JSON.parse(objectText) as ConfigValue);
      const result = await api<{ document: FeatureDataDocument; backupPath: string | null }>(
        "/api/feature/data",
        json("PUT", { key: resource, value, version: document.version }),
      );
      setDocument(result.document);
      setBackupPath(result.backupPath);
      notify("特色页数据已保存。");
      if (Array.isArray(result.document.value)) {
        itemKeys.current = result.document.value.map(() => crypto.randomUUID());
        setItems(result.document.value.map((item) => JSON.stringify(item, null, 2)));
      } else setObjectText(JSON.stringify(result.document.value, null, 2));
    } catch (cause) {
      fail(errorMessage(cause, "数据保存失败"));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!document || !backupPath) return;
    setBusy(true);
    try {
      await api(
        "/api/feature/restore",
        json("POST", { kind: "data", key: resource, backupPath, version: document.version }),
      );
      notify("已恢复保存前的数据。");
      await load();
    } catch (cause) {
      fail(errorMessage(cause, "恢复失败"));
    } finally {
      setBusy(false);
    }
  }
  if (!document) return <LoadingPaper />;
  return (
    <Stack spacing={2}>
      {document.warnings.map((warning) => (
        <Alert severity="warning" key={warning}>
          {warning}
        </Alert>
      ))}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          useFlexGap
          sx={{ alignItems: { sm: "center" }, flexWrap: "wrap", mb: 2 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6">{document.descriptor.label}</Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "var(--mizuki-panel-font-mono)", overflowWrap: "anywhere" }}
            >
              {document.sourcePath}
            </Typography>
          </Box>
          {document.descriptor.shape === "array" && (
            <Button
              startIcon={<AddOutlined />}
              onClick={() => {
                pagination.reveal(items.length);
                itemKeys.current.push(crypto.randomUUID());
                setItems((current) => [...current, "{}"]);
              }}
              disabled={document.readOnly || busy}
            >
              添加条目
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            onClick={save}
            disabled={document.readOnly || busy}
          >
            保存
          </Button>
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
        {document.descriptor.shape === "array" ? (
          <Stack spacing={1.5}>
            <FeaturePagination count={items.length} pagination={pagination} />
            {items.slice(pagination.start, pagination.end).map((item, offset) => {
              const index = pagination.start + offset;
              return (
                <Card variant="outlined" key={itemKeys.current[index]}>
                  <CardContent>
                    <SyntaxEditor
                      language="json"
                      label={`第 ${index + 1} 项（JSON）`}
                      value={item}
                      onChange={(text) =>
                        setItems((current) =>
                          current.map((value, itemIndex) => (itemIndex === index ? text : value)),
                        )
                      }
                      disabled={document.readOnly || busy}
                    />
                  </CardContent>
                  <CardActions>
                    <Tooltip title="上移">
                      <span>
                        <IconButton
                          aria-label={`上移第 ${index + 1} 项`}
                          onClick={() => move(index, -1)}
                          disabled={document.readOnly || busy || index === 0}
                        >
                          <ArrowUpwardOutlined />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="下移">
                      <span>
                        <IconButton
                          onClick={() => move(index, 1)}
                          aria-label={`下移第 ${index + 1} 项`}
                          disabled={document.readOnly || busy || index === items.length - 1}
                        >
                          <ArrowDownwardOutlined />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      color="error"
                      disabled={document.readOnly || busy}
                      startIcon={<DeleteOutline />}
                      onClick={() => {
                        itemKeys.current.splice(index, 1);
                        setItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        );
                      }}
                    >
                      删除
                    </Button>
                  </CardActions>
                </Card>
              );
            })}
            {!items.length && (
              <Typography color="text.secondary">暂无条目，可点击“添加条目”创建。</Typography>
            )}
            {items.length > pagination.pageSize && (
              <FeaturePagination count={items.length} pagination={pagination} />
            )}
          </Stack>
        ) : (
          <SyntaxEditor
            language="json"
            label="分组数据（JSON）"
            value={objectText}
            onChange={setObjectText}
            height="480px"
            minHeight="480px"
            maxHeight="480px"
            disabled={document.readOnly || busy}
          />
        )}
      </Paper>
    </Stack>
  );
}
