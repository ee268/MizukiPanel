import { useCallback, useEffect, useMemo, useState } from "react";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import {
  Box,
  Button,
  Chip,
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
import type { AlbumRecord, ProjectReport } from "../types";

export function Albums({
  report,
  notify,
  fail,
}: {
  report: ProjectReport;
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [infoText, setInfoText] = useState("");
  const [newId, setNewId] = useState("");
  const [upload, setUpload] = useState<File | null>(null);
  const album = useMemo(() => albums.find((item) => item.id === selected), [albums, selected]);
  const load = useCallback(async () => {
    try {
      const data = await api<{ albums: AlbumRecord[] }>("/api/feature/albums");
      setAlbums(data.albums);
    } catch (cause) {
      fail(errorMessage(cause, "相册读取失败"));
    }
  }, [fail]);
  useEffect(() => {
    void load();
  }, [load]);
  function choose(item: AlbumRecord) {
    setSelected(item.id);
    setNewId("");
    setInfoText(JSON.stringify(item.info, null, 2));
  }
  function create() {
    setSelected("");
    setNewId("");
    setInfoText(
      JSON.stringify(
        {
          title: "新相册",
          description: "",
          date: new Date().toISOString().slice(0, 10),
          location: "",
          tags: [],
          layout: "grid",
          columns: 3,
          hidden: false,
        },
        null,
        2,
      ),
    );
  }
  async function save() {
    const id = album?.id ?? newId;
    if (!id) return fail("请输入相册 ID");
    try {
      const info = JSON.parse(infoText) as Record<string, unknown>;
      const result = await api<{ albums: { albums: AlbumRecord[] } }>(
        "/api/feature/album",
        json("PUT", { id, info, version: album?.version ?? "" }),
      );
      setAlbums(result.albums.albums);
      const next = result.albums.albums.find((item) => item.id === id);
      if (next) choose(next);
      notify("相册信息已保存。");
    } catch (cause) {
      fail(errorMessage(cause, "相册保存失败"));
    }
  }
  async function remove() {
    if (!album) return;
    try {
      await api("/api/feature/album", json("DELETE", { id: album.id, version: album.version }));
      setSelected("");
      setInfoText("");
      notify("相册目录已移入回收目录。");
      await load();
    } catch (cause) {
      fail(errorMessage(cause, "相册删除失败"));
    }
  }
  async function uploadPhoto() {
    if (!album || !upload) return;
    const form = new FormData();
    form.set("scope", "public");
    form.set("folder", `albums/${album.id}`);
    form.set("file", upload);
    try {
      await api("/api/media", { method: "POST", body: form });
      setUpload(null);
      notify("相册图片已上传。");
      await load();
    } catch (cause) {
      fail(errorMessage(cause, "图片上传失败"));
    }
  }
  async function deletePhoto(photo: string) {
    if (!album) return;
    try {
      await api(
        "/api/media",
        json("DELETE", { scope: "public", path: `albums/${album.id}/${photo}` }),
      );
      notify("相册图片已移入回收目录。");
      await load();
    } catch (cause) {
      fail(errorMessage(cause, "图片删除失败"));
    }
  }
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper variant="outlined">
          <Stack direction="row" sx={{ p: 1.5 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              相册
            </Typography>
            <Button startIcon={<AddOutlined />} onClick={create}>
              新建
            </Button>
          </Stack>
          <Divider />
          <List>
            {albums.map((item) => (
              <ListItemButton
                key={item.id}
                selected={selected === item.id}
                onClick={() => choose(item)}
              >
                <ListItemText
                  primary={String(item.info.title ?? item.id)}
                  secondary={`${item.id} · ${item.photos.length} 个本地图片`}
                />
                <Chip
                  size="small"
                  color={item.complete ? "success" : "warning"}
                  label={item.complete ? "完整" : "待补全"}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          {!album && (
            <TextField
              label="新相册 ID"
              value={newId}
              onChange={(event) => setNewId(event.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            label="info.json"
            value={infoText}
            onChange={(event) => setInfoText(event.target.value)}
            multiline
            minRows={20}
            fullWidth
            sx={{ "& textarea": { fontFamily: "var(--mizuki-panel-font-mono)", fontSize: 13 } }}
          />
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={<SaveOutlined />}
              onClick={save}
              disabled={report.readOnly}
            >
              保存
            </Button>
            {album && (
              <Button color="error" startIcon={<DeleteOutline />} onClick={remove}>
                删除相册
              </Button>
            )}
          </Stack>
          {album && album.info.mode !== "external" && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6">本地图片</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                封面文件需命名为 cover.webp 或
                cover.jpg；其他支持格式将作为照片。删除操作会先移入面板回收目录。
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
                {album.photos.map((photo) => (
                  <Chip
                    key={photo}
                    label={photo}
                    onDelete={report.readOnly ? undefined : () => void deletePhoto(photo)}
                  />
                ))}
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button component="label" variant="outlined" startIcon={<UploadOutlined />}>
                  {upload?.name ?? "选择图片"}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                    onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
                  />
                </Button>
                <Button onClick={uploadPhoto} disabled={!upload}>
                  上传
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
