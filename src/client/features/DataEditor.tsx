import { useCallback, useEffect, useState } from "react";
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { api, json } from "../api";
import type { ConfigValue, FeatureDataDocument } from "../types";
import { errorText } from "./common";
import { LoadingPaper } from "./LoadingPaper";
export function DataEditor({
  resource,
  notify,
  fail,
}: {
  resource: string;
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [document, setDocument] = useState<FeatureDataDocument | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [objectText, setObjectText] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api<FeatureDataDocument>(
        `/api/feature/data?key=${encodeURIComponent(resource)}`,
      );
      setDocument(data);
      setBackupPath(null);
      if (Array.isArray(data.value))
        setItems(data.value.map((item) => JSON.stringify(item, null, 2)));
      else setObjectText(JSON.stringify(data.value, null, 2));
    } catch (cause) {
      fail(errorText(cause, "数据读取失败"));
    } finally {
      setBusy(false);
    }
  }, [fail, resource]);
  useEffect(() => {
    void load();
  }, [load]);
  function move(index: number, offset: number) {
    setItems((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
      if (Array.isArray(result.document.value))
        setItems(result.document.value.map((item) => JSON.stringify(item, null, 2)));
      else setObjectText(JSON.stringify(result.document.value, null, 2));
    } catch (cause) {
      fail(errorText(cause, "数据保存失败"));
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
      fail(errorText(cause, "恢复失败"));
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
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{document.descriptor.label}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {document.sourcePath}
            </Typography>
          </Box>
          {document.descriptor.shape === "array" && (
            <Button
              startIcon={<AddOutlined />}
              onClick={() => setItems((current) => [...current, "{}"])}
              disabled={document.readOnly}
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
            <Button color="warning" startIcon={<RestoreOutlined />} onClick={restore}>
              撤销保存
            </Button>
          )}
        </Stack>
        {document.descriptor.shape === "array" ? (
          <Stack spacing={1.5}>
            {items.map((item, index) => (
              <Card variant="outlined" key={index}>
                <CardContent>
                  <TextField
                    label={`第 ${index + 1} 项（JSON）`}
                    value={item}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.value : value,
                        ),
                      )
                    }
                    multiline
                    minRows={5}
                    fullWidth
                    sx={{ "& textarea": { fontFamily: "monospace", fontSize: 13 } }}
                  />
                </CardContent>
                <CardActions>
                  <Tooltip title="上移">
                    <span>
                      <IconButton onClick={() => move(index, -1)} disabled={index === 0}>
                        <ArrowUpwardOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="下移">
                    <span>
                      <IconButton
                        onClick={() => move(index, 1)}
                        disabled={index === items.length - 1}
                      >
                        <ArrowDownwardOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    color="error"
                    startIcon={<DeleteOutline />}
                    onClick={() =>
                      setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    删除
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        ) : (
          <TextField
            label="分组数据（JSON）"
            value={objectText}
            onChange={(event) => setObjectText(event.target.value)}
            multiline
            minRows={24}
            fullWidth
            sx={{ "& textarea": { fontFamily: "monospace", fontSize: 13 } }}
          />
        )}
      </Paper>
    </Stack>
  );
}
