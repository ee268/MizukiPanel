import { useCallback, useEffect, useState } from "react";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Button,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { AnimeSeason, AnimeSeasonDocument } from "../types";

export function AnimeSeasons({
  notify,
  fail,
}: {
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [seasons, setSeasons] = useState<AnimeSeason[]>([]);
  const [selected, setSelected] = useState("");
  const [document, setDocument] = useState<AnimeSeasonDocument | null>(null);
  const [content, setContent] = useState("");
  const [newId, setNewId] = useState("");
  const loadList = useCallback(async () => {
    try {
      const data = await api<{ seasons: AnimeSeason[] }>("/api/feature/anime-seasons");
      setSeasons(data.seasons);
    } catch (cause) {
      fail(errorMessage(cause, "季度列表读取失败"));
    }
  }, [fail]);
  useEffect(() => {
    void loadList();
  }, [loadList]);
  async function choose(id: string) {
    try {
      const data = await api<AnimeSeasonDocument>(
        `/api/feature/anime-season?id=${encodeURIComponent(id)}`,
      );
      setSelected(id);
      setDocument(data);
      setContent(data.content);
    } catch (cause) {
      fail(errorMessage(cause, "季度内容读取失败"));
    }
  }
  async function save() {
    const id = document?.id ?? newId;
    if (!id) return fail("请输入季度路径");
    try {
      const result = await api<{ document: AnimeSeasonDocument }>(
        "/api/feature/anime-season",
        json("PUT", { id, content, version: document?.version ?? "" }),
      );
      setDocument(result.document);
      setSelected(id);
      setNewId("");
      notify("季度内容已保存。");
      await loadList();
    } catch (cause) {
      fail(errorMessage(cause, "季度内容保存失败"));
    }
  }
  async function remove() {
    if (!document) return;
    try {
      await api(
        "/api/feature/anime-season",
        json("DELETE", { id: document.id, version: document.version }),
      );
      setDocument(null);
      setContent("");
      setSelected("");
      notify("季度文件已移入回收目录。");
      await loadList();
    } catch (cause) {
      fail(errorMessage(cause, "季度删除失败"));
    }
  }
  function create() {
    setDocument(null);
    setSelected("");
    setContent("---\ntitle: 新番季度\ndate: 2027/01/01\ncomments: true\n---\n\n{% 123456 %}\n");
  }
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper variant="outlined">
          <Stack direction="row" sx={{ p: 1.5 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              季度文件
            </Typography>
            <Button startIcon={<AddOutlined />} onClick={create}>
              新建
            </Button>
          </Stack>
          <Divider />
          <List>
            {seasons.map((item) => (
              <ListItemButton
                key={item.id}
                selected={selected === item.id}
                onClick={() => void choose(item.id)}
              >
                <ListItemText primary={item.id} secondary={`${item.size} bytes`} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          {!document && (
            <TextField
              label="新季度路径"
              placeholder="2027/1月.md"
              value={newId}
              onChange={(event) => setNewId(event.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            label="季度 Markdown"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            multiline
            minRows={24}
            fullWidth
            sx={{ "& textarea": { fontFamily: "monospace", fontSize: 13 } }}
          />
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<SaveOutlined />} onClick={save}>
              保存
            </Button>
            {document && (
              <Button color="error" startIcon={<DeleteOutline />} onClick={remove}>
                删除
              </Button>
            )}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
