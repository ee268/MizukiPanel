import { useCallback, useEffect, useRef, useState } from "react";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  Alert,
  Autocomplete,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import { useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import type { AnimeSeason, AnimeSeasonDocument, ProjectReport } from "../types";
import { useLiveProjectDocument } from "../workspace/WorkspaceSessionProvider";
import { useFeaturePagination } from "./useFeaturePagination";
import { FeaturePagination } from "./FeaturePagination";
import { SyntaxEditor } from "../components/SyntaxEditor";
import { BangumiSearchDialog } from "./BangumiSearchDialog";
import { BangumiSettingsDialog } from "./BangumiSettingsDialog";
import { bangumiSubjectMarker } from "../../shared/bangumi-search";
import {
  animeSeasonId,
  animeSeasonMonths,
  animeSeasonTemplate,
  groupAnimeSeasons,
} from "../../shared/anime-seasons";

export function AnimeSeasons({
  report,
  notify,
  fail,
}: {
  report: ProjectReport;
  notify: (value: string) => void;
  fail: (value: string) => void;
}) {
  const [seasons, setSeasons] = useState<AnimeSeason[]>([]);
  const groups = groupAnimeSeasons(seasons);
  const pagination = useFeaturePagination(groups.length);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState("");
  const [loadedDocument, setDocument] = useState<AnimeSeasonDocument | null>(null);
  const document = useLiveProjectDocument(loadedDocument);
  const [content, setContent] = useState("");
  const [newId, setNewId] = useState("");
  const [defaultAuthor, setDefaultAuthor] = useState("");
  const [listLoaded, setListLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);
  const editor = useRef<ReactCodeMirrorRef>(null);
  const currentYear = String(new Date().getFullYear());
  const [newYear, setNewYear] = useState(currentYear);
  const [newMonth, setNewMonth] = useState<number>(1);
  const detail = useRef<HTMLDivElement>(null);
  const transition = useRef<Animation | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const detailId = document?.id ?? newId;
  useEffect(() => setSearchOpen(false), [detailId]);
  useEffect(() => {
    const element = detail.current;
    if (!detailId || !element || reducedMotion || !element.animate) return;
    const animation = element.animate(
      [
        { opacity: 0, transform: "translateX(12px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
    animation.id = "anime-season-detail";
    transition.current = animation;
    return () => {
      animation.cancel();
      transition.current = null;
    };
  }, [detailId, reducedMotion]);
  const readOnly = report.readOnly || Boolean(document?.readOnly);
  const validYear = /^[1-9]\d{3}$/.test(newYear);
  const duplicate = seasons.some((item) => item.id === `${newYear}/${newMonth}月.md`);
  function insertSubject(id: number) {
    const view = editor.current?.view;
    if (!view || !detailId || readOnly || busy) return;
    view.dispatch({
      ...view.state.replaceSelection(bangumiSubjectMarker(id)),
      userEvent: "input.complete",
      scrollIntoView: true,
    });
    setSearchOpen(false);
    requestAnimationFrame(() => view.focus());
  }
  const yearOptions = [
    ...new Set([
      ...groups.map((group) => group.year),
      String(Number(currentYear) + 1),
      currentYear,
      String(Number(currentYear) - 1),
    ]),
  ].sort((a, b) => Number(b) - Number(a));
  useUnsavedSessionRecovery(
    "追番季度",
    Boolean((document ? content !== document.content : Boolean(content)) || newId),
    { kind: "animeSeason", id: document?.id ?? newId, content, baseVersion: document?.version },
  );
  const loadList = useCallback(async () => {
    try {
      const data = await api<{ seasons: AnimeSeason[]; defaultAuthor: string }>(
        "/api/feature/anime-seasons",
      );
      setSeasons(data.seasons);
      setDefaultAuthor(data.defaultAuthor ?? "");
      setListLoaded(true);
      return data.seasons;
    } catch (cause) {
      fail(errorMessage(cause, "季度列表读取失败"));
    }
  }, [fail]);
  useEffect(() => {
    void loadList();
  }, [loadList]);
  function reveal(id: string, entries: AnimeSeason[]) {
    const year = id.split("/")[0];
    setExpandedYears((previous) => ({ ...previous, [year]: true }));
    pagination.reveal(groupAnimeSeasons(entries).findIndex((group) => group.year === year));
  }
  async function choose(id: string) {
    if (busy || (id === document?.id && !newId)) return;
    const previous = selected;
    setSelected(id);
    setBusy(true);
    try {
      const data = await api<AnimeSeasonDocument>(
        `/api/feature/anime-season?id=${encodeURIComponent(id)}`,
      );
      setDocument(data);
      setNewId("");
      setContent(data.content);
      reveal(id, seasons);
    } catch (cause) {
      setSelected(previous);
      fail(errorMessage(cause, "季度内容读取失败"));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const id = document?.id ?? newId;
    if (!id || readOnly || busy) return;
    setBusy(true);
    try {
      const result = await api<{ document: AnimeSeasonDocument }>(
        "/api/feature/anime-season",
        json("PUT", { id, content, version: document?.version ?? "" }),
      );
      setDocument(result.document);
      setContent(result.document.content);
      setSelected(id);
      setNewId("");
      notify("季度内容已保存。");
      const entries = await loadList();
      if (entries) reveal(id, entries);
    } catch (cause) {
      fail(errorMessage(cause, "季度内容保存失败"));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!document || readOnly || busy) return;
    setBusy(true);
    try {
      await api(
        "/api/feature/anime-season",
        json("DELETE", { id: document.id, version: document.version }),
      );
      setDocument(null);
      setContent("");
      setNewId("");
      setSelected("");
      notify("季度文件已移入回收目录。");
      await loadList();
    } catch (cause) {
      fail(errorMessage(cause, "季度删除失败"));
    } finally {
      setBusy(false);
    }
  }
  function selectYear(year: string) {
    setNewYear(year);
    const currentQuarter = Math.floor(new Date().getMonth() / 3) * 3 + 1;
    const available = animeSeasonMonths.filter(
      (month) => !seasons.some((item) => item.id === `${year}/${month}月.md`),
    );
    setNewMonth(
      (year === currentYear ? available.find((month) => month >= currentQuarter) : undefined) ??
        available[0] ??
        1,
    );
  }
  function openCreate() {
    selectYear(currentYear);
    setCreateOpen(true);
  }
  function create() {
    if (!validYear || duplicate || readOnly || busy) return;
    const id = animeSeasonId(newYear, newMonth);
    setDocument(null);
    setSelected("");
    setNewId(id);
    setContent(animeSeasonTemplate(newYear, newMonth, defaultAuthor));
    setCreateOpen(false);
  }
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined">
            <Stack direction="row" sx={{ p: 1.5 }}>
              <Typography variant="h6" sx={{ flex: 1 }}>
                季度文件
              </Typography>
              <Button
                startIcon={<AddOutlined />}
                onClick={openCreate}
                disabled={readOnly || busy || !listLoaded}
              >
                新建
              </Button>
            </Stack>
            <Divider />
            <List>
              {groups.slice(pagination.start, pagination.end).map(({ year, items }) => {
                const expanded = expandedYears[year] ?? year === groups[0]?.year;
                return (
                  <li key={year}>
                    <ListItemButton
                      onClick={() =>
                        setExpandedYears((previous) => ({ ...previous, [year]: !expanded }))
                      }
                      aria-expanded={expanded}
                      aria-controls={`anime-year-${year}`}
                    >
                      <ListItemText
                        primary={`${year}年`}
                        secondary={`${items.length} / 4 个季度`}
                      />
                      {expanded ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                    <Collapse in={expanded} id={`anime-year-${year}`} unmountOnExit>
                      <List disablePadding>
                        {items.map((item) => (
                          <ListItemButton
                            key={item.id}
                            data-season-id={item.id}
                            selected={selected === item.id}
                            aria-current={selected === item.id ? "true" : undefined}
                            disabled={busy}
                            onClick={() => void choose(item.id)}
                            sx={{
                              pl: 4,
                              position: "relative",
                              transition: (theme) =>
                                theme.transitions.create(["background-color", "color"], {
                                  duration: 180,
                                }),
                              "&.Mui-selected": {
                                color: "primary.main",
                                bgcolor:
                                  "color-mix(in srgb, var(--mui-palette-primary-main) 12%, var(--mui-palette-background-paper))",
                                "&::before": {
                                  content: '""',
                                  position: "absolute",
                                  left: 16,
                                  top: 10,
                                  bottom: 10,
                                  width: 3,
                                  borderRadius: 1,
                                  bgcolor: "primary.main",
                                },
                                "& .MuiListItemText-primary": { fontWeight: 700 },
                                "& .MuiListItemText-secondary": { color: "inherit", opacity: 0.8 },
                              },
                              "&.Mui-selected:hover": {
                                bgcolor:
                                  "color-mix(in srgb, var(--mui-palette-primary-main) 18%, var(--mui-palette-background-paper))",
                              },
                              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                            }}
                          >
                            <ListItemText
                              primary={item.id.split("/")[1]}
                              secondary={`${item.size} bytes`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Collapse>
                  </li>
                );
              })}
              {listLoaded && groups.length === 0 && (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  暂无季度文件，点击“新建”开始。
                </Typography>
              )}
            </List>
            <FeaturePagination count={groups.length} pagination={pagination} itemLabel="年" />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            ref={detail}
            data-anime-season-detail
            role="region"
            aria-label="季度文件详细"
            aria-busy={busy}
            onPointerDownCapture={() => transition.current?.cancel()}
            variant="outlined"
            sx={{ p: 2.5 }}
          >
            {document || newId ? (
              <>
                <Stack
                  direction="row"
                  sx={{
                    mb: 2,
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography>{detailId}</Typography>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                    <Button
                      startIcon={<SearchOutlined />}
                      onClick={() => setSearchOpen(true)}
                      disabled={readOnly || busy}
                    >
                      搜索动画
                    </Button>
                    <Button
                      startIcon={<SettingsOutlined />}
                      onClick={() => setSearchSettingsOpen(true)}
                      disabled={busy}
                    >
                      搜索设置
                    </Button>
                  </Stack>
                </Stack>
                <SyntaxEditor
                  key={detailId}
                  editorRef={editor}
                  initialCursorAtEnd
                  language="markdown"
                  label="季度 Markdown"
                  value={content}
                  onChange={setContent}
                  height="480px"
                  minHeight="480px"
                  maxHeight="480px"
                  disabled={readOnly || busy}
                />
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlined />}
                    onClick={save}
                    disabled={readOnly || busy}
                  >
                    保存
                  </Button>
                  {document && (
                    <Button
                      color="error"
                      startIcon={<DeleteOutline />}
                      onClick={remove}
                      disabled={readOnly || busy}
                    >
                      删除
                    </Button>
                  )}
                </Stack>
              </>
            ) : (
              <Typography
                color="text.secondary"
                sx={{ minHeight: 480, display: "grid", placeItems: "center" }}
              >
                展开年份选择季度文件，或新建季度内容。
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
      {searchSettingsOpen && (
        <BangumiSettingsDialog
          onClose={() => setSearchSettingsOpen(false)}
          onSaved={() => notify("搜索设置已保存。")}
        />
      )}
      {searchOpen && (
        <BangumiSearchDialog
          onClose={() => setSearchOpen(false)}
          onInsert={insertSubject}
          disabled={readOnly || busy}
        />
      )}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>新建季度内容</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              freeSolo
              options={yearOptions}
              inputValue={newYear}
              onInputChange={(_, value) => selectYear(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="年份"
                  error={!validYear}
                  helperText={
                    validYear
                      ? "可选择已有年份，也可输入新的四位年份。"
                      : "请输入 1000–9999 之间的年份。"
                  }
                />
              )}
            />
            <TextField
              select
              label="季度"
              value={newMonth}
              onChange={(event) => setNewMonth(Number(event.target.value))}
            >
              {animeSeasonMonths.map((month) => {
                const exists = seasons.some((item) => item.id === `${newYear}/${month}月.md`);
                return (
                  <MenuItem key={month} value={month} disabled={exists}>
                    {month}月{exists ? "（已存在）" : ""}
                  </MenuItem>
                );
              })}
            </TextField>
            {duplicate && <Alert severity="info">该季度已存在，请选择其他季度或年份。</Alert>}
            {validYear && (
              <Typography variant="body2" color="text.secondary">
                目标：{newYear}/{newMonth}月.md
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={create}
            disabled={!validYear || duplicate || readOnly || busy}
          >
            新建季度
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
