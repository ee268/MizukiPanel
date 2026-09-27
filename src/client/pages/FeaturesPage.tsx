import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Container,
  Divider, Grid, IconButton, List, ListItemButton, ListItemText, Paper, Snackbar, Stack,
  Tab, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import RestoreOutlined from '@mui/icons-material/RestoreOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import UploadOutlined from '@mui/icons-material/UploadOutlined';
import { useNavigate } from 'react-router-dom';
import { api, json } from '../api';
import type {
  AlbumRecord, AnimeSeason, AnimeSeasonDocument, ConfigValue, FeatureDataDescriptor,
  FeatureDataDocument, FeatureModule, FeatureTextDocument, ProjectReport
} from '../types';

interface IndexResponse { report: ProjectReport; modules: FeatureModule[]; dataResources: FeatureDataDescriptor[] }
const errorText = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;

export default function FeaturesPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState<IndexResponse | null>(null);
  const [selected, setSelected] = useState('about');
  const [resourceTab, setResourceTab] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { api<IndexResponse>('/api/features').then(setIndex).catch((cause) => setError(errorText(cause, '特色页清单读取失败'))); }, []);
  const module = index?.modules.find((item) => item.key === selected);
  useEffect(() => { setResourceTab(0); }, [selected]);
  const resources = module?.resources ?? [];
  return <Container maxWidth={false} sx={{ py: 4 }}><Stack spacing={3}>
    <Box><Typography variant="h4">特色页面</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>管理 Markdown 正文、结构化数据、季度追番和相册资源。</Typography></Box>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {!index ? <Paper variant="outlined" sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Paper> : <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 3, lg: 2.5 }}><Paper variant="outlined" sx={{ position: { md: 'sticky' }, top: { md: 88 } }}><List disablePadding>{index.modules.map((item) => <ListItemButton key={item.key} selected={selected === item.key} onClick={() => setSelected(item.key)}>
        <ListItemText primary={item.label} secondary={!item.enabled ? '页面已关闭' : !item.navigationConfigured && item.switchKey ? '导航未配置' : '可管理'} />
        <Chip size="small" color={item.enabled ? 'success' : 'default'} label={item.enabled ? '开' : '关'} />
      </ListItemButton>)}</List></Paper></Grid>
      <Grid size={{ xs: 12, md: 9, lg: 9.5 }}><Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <Box sx={{ flex: 1 }}><Typography variant="h5">{module?.label}</Typography><Typography color="text.secondary">{module?.pagePath}</Typography></Box>
          {module?.sourceMode && <Chip color="info" label={`数据源：${module.sourceMode}`} />}
          <Button startIcon={<OpenInNewOutlined />} onClick={() => navigate(`/preview?path=${encodeURIComponent(module?.pagePath ?? '/')}`)}>真实预览</Button>
          {module?.switchKey && <Button onClick={() => navigate('/config')}>页面开关与导航</Button>}
        </Stack>
        {module && !module.enabled && <Alert severity="warning" sx={{ mt: 2 }}>该页面已在 `siteConfig.featurePages` 中关闭。可继续编辑内容，预览前需要打开页面开关。</Alert>}
        {module?.switchKey && module.enabled && !module.navigationConfigured && <Alert severity="info" sx={{ mt: 2 }}>页面已打开，但导航配置中未检测到入口。</Alert>}
        {resources.length > 1 && <Tabs value={resourceTab} onChange={(_, value) => setResourceTab(value)} sx={{ mt: 1 }}>{resources.map((key) => <Tab key={key} label={resourceLabel(key)} />)}</Tabs>}
        </Paper>
        {module && ((module.key === 'diary' && module.sourceMode === 'memos') || (module.key === 'anime' && resources[resourceTab] === 'anime' && module.sourceMode !== 'local'))
          ? <Paper variant="outlined" sx={{ p: 3 }}><Alert severity="info">{module.sourceStatus}。当前模式的数据由外部服务更新，面板不修改本地列表；请在站点配置中调整数据源。</Alert><Button sx={{ mt: 2 }} onClick={() => navigate('/config')}>打开站点配置</Button></Paper>
          : module && <ResourcePanel resource={resources[resourceTab]} report={index.report} notify={setNotice} fail={setError} />}
      </Stack></Grid>
    </Grid>}
  </Stack><Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice('')} message={notice} /></Container>;
}

function resourceLabel(key: string) {
  return ({ aboutText: '关于正文', friendsText: '友链说明', friends: '友链列表', diary: '日记条目', anime: '本地追番', animeSeasons: '季度内容', albums: '相册' } as Record<string, string>)[key] ?? key;
}

function ResourcePanel({ resource, report, notify, fail }: { resource?: string; report: ProjectReport; notify: (value: string) => void; fail: (value: string) => void }) {
  if (!resource) return null;
  if (resource === 'aboutText' || resource === 'friendsText') return <TextEditor key={resource} resource={resource} notify={notify} fail={fail} />;
  if (resource === 'animeSeasons') return <AnimeSeasons notify={notify} fail={fail} />;
  if (resource === 'albums') return <Albums report={report} notify={notify} fail={fail} />;
  return <DataEditor key={resource} resource={resource} notify={notify} fail={fail} />;
}

function DataEditor({ resource, notify, fail }: { resource: string; notify: (value: string) => void; fail: (value: string) => void }) {
  const [document, setDocument] = useState<FeatureDataDocument | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [objectText, setObjectText] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    try { const data = await api<FeatureDataDocument>(`/api/feature/data?key=${encodeURIComponent(resource)}`); setDocument(data); setBackupPath(null);
      if (Array.isArray(data.value)) setItems(data.value.map((item) => JSON.stringify(item, null, 2))); else setObjectText(JSON.stringify(data.value, null, 2));
    } catch (cause) { fail(errorText(cause, '数据读取失败')); } finally { setBusy(false); }
  }, [fail, resource]);
  useEffect(() => { void load(); }, [load]);
  function move(index: number, offset: number) { setItems((current) => { const next = [...current]; const target = index + offset; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  async function save() {
    if (!document) return; setBusy(true);
    try {
      const value = document.descriptor.shape === 'array' ? items.map((item, index) => { try { return JSON.parse(item) as ConfigValue; } catch { throw new Error(`第 ${index + 1} 项不是有效 JSON`); } }) : JSON.parse(objectText) as ConfigValue;
      const result = await api<{ document: FeatureDataDocument; backupPath: string | null }>('/api/feature/data', json('PUT', { key: resource, value, version: document.version }));
      setDocument(result.document); setBackupPath(result.backupPath); notify('特色页数据已保存。');
      if (Array.isArray(result.document.value)) setItems(result.document.value.map((item) => JSON.stringify(item, null, 2))); else setObjectText(JSON.stringify(result.document.value, null, 2));
    } catch (cause) { fail(errorText(cause, '数据保存失败')); } finally { setBusy(false); }
  }
  async function restore() {
    if (!document || !backupPath) return; setBusy(true);
    try { await api('/api/feature/restore', json('POST', { kind: 'data', key: resource, backupPath, version: document.version })); notify('已恢复保存前的数据。'); await load(); }
    catch (cause) { fail(errorText(cause, '恢复失败')); } finally { setBusy(false); }
  }
  if (!document) return <LoadingPaper />;
  return <Stack spacing={2}>
    {document.warnings.map((warning) => <Alert severity="warning" key={warning}>{warning}</Alert>)}
    <Paper variant="outlined" sx={{ p: 2.5 }}><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}><Box sx={{ flex: 1 }}><Typography variant="h6">{document.descriptor.label}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{document.sourcePath}</Typography></Box>
      {document.descriptor.shape === 'array' && <Button startIcon={<AddOutlined />} onClick={() => setItems((current) => [...current, '{}'])} disabled={document.readOnly}>添加条目</Button>}
      <Button variant="contained" startIcon={<SaveOutlined />} onClick={save} disabled={document.readOnly || busy}>保存</Button>{backupPath && <Button color="warning" startIcon={<RestoreOutlined />} onClick={restore}>撤销保存</Button>}
    </Stack>
    {document.descriptor.shape === 'array' ? <Stack spacing={1.5}>{items.map((item, index) => <Card variant="outlined" key={index}><CardContent><TextField label={`第 ${index + 1} 项（JSON）`} value={item} onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} multiline minRows={5} fullWidth sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }} /></CardContent><CardActions>
      <Tooltip title="上移"><span><IconButton onClick={() => move(index, -1)} disabled={index === 0}><ArrowUpwardOutlined /></IconButton></span></Tooltip><Tooltip title="下移"><span><IconButton onClick={() => move(index, 1)} disabled={index === items.length - 1}><ArrowDownwardOutlined /></IconButton></span></Tooltip><Box sx={{ flex: 1 }} /><Button color="error" startIcon={<DeleteOutline />} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</Button>
    </CardActions></Card>)}</Stack> : <TextField label="分组数据（JSON）" value={objectText} onChange={(event) => setObjectText(event.target.value)} multiline minRows={24} fullWidth sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }} />}
    </Paper>
  </Stack>;
}

function TextEditor({ resource, notify, fail }: { resource: string; notify: (value: string) => void; fail: (value: string) => void }) {
  const [document, setDocument] = useState<FeatureTextDocument | null>(null); const [content, setContent] = useState(''); const [busy, setBusy] = useState(false); const [backupPath, setBackupPath] = useState<string | null>(null);
  const load = useCallback(async () => { try { const data = await api<FeatureTextDocument>(`/api/feature/text?key=${resource}`); setDocument(data); setContent(data.content); } catch (cause) { fail(errorText(cause, '正文读取失败')); } }, [fail, resource]);
  useEffect(() => { void load(); }, [load]);
  async function save() { if (!document) return; setBusy(true); try { const result = await api<{ document: FeatureTextDocument; backupPath: string | null }>('/api/feature/text', json('PUT', { key: resource, content, version: document.version })); setDocument(result.document); setBackupPath(result.backupPath); notify('正文已保存。'); } catch (cause) { fail(errorText(cause, '正文保存失败')); } finally { setBusy(false); } }
  async function restore() { if (!document || !backupPath) return; try { const result = await api<FeatureTextDocument>('/api/feature/restore', json('POST', { kind: 'text', key: resource, backupPath, version: document.version })); setDocument(result); setContent(result.content); setBackupPath(null); notify('正文已恢复。'); } catch (cause) { fail(errorText(cause, '恢复失败')); } }
  if (!document) return <LoadingPaper />;
  return <Paper variant="outlined" sx={{ p: 2.5 }}><Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center' }}><Typography variant="h6" sx={{ flex: 1 }}>{document.label}</Typography><Button variant="contained" startIcon={<SaveOutlined />} onClick={save} disabled={busy || document.readOnly}>保存</Button>{backupPath && <Button color="warning" startIcon={<RestoreOutlined />} onClick={restore}>撤销保存</Button>}</Stack><TextField value={content} onChange={(event) => setContent(event.target.value)} multiline minRows={28} fullWidth sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 } }} /></Paper>;
}

function AnimeSeasons({ notify, fail }: { notify: (value: string) => void; fail: (value: string) => void }) {
  const [seasons, setSeasons] = useState<AnimeSeason[]>([]); const [selected, setSelected] = useState(''); const [document, setDocument] = useState<AnimeSeasonDocument | null>(null); const [content, setContent] = useState(''); const [newId, setNewId] = useState('');
  const loadList = useCallback(async () => { try { const data = await api<{ seasons: AnimeSeason[] }>('/api/feature/anime-seasons'); setSeasons(data.seasons); } catch (cause) { fail(errorText(cause, '季度列表读取失败')); } }, [fail]);
  useEffect(() => { void loadList(); }, [loadList]);
  async function choose(id: string) { try { const data = await api<AnimeSeasonDocument>(`/api/feature/anime-season?id=${encodeURIComponent(id)}`); setSelected(id); setDocument(data); setContent(data.content); } catch (cause) { fail(errorText(cause, '季度内容读取失败')); } }
  async function save() { const id = document?.id ?? newId; if (!id) return fail('请输入季度路径'); try { const result = await api<{ document: AnimeSeasonDocument }>('/api/feature/anime-season', json('PUT', { id, content, version: document?.version ?? '' })); setDocument(result.document); setSelected(id); setNewId(''); notify('季度内容已保存。'); await loadList(); } catch (cause) { fail(errorText(cause, '季度内容保存失败')); } }
  async function remove() { if (!document) return; try { await api('/api/feature/anime-season', json('DELETE', { id: document.id, version: document.version })); setDocument(null); setContent(''); setSelected(''); notify('季度文件已移入回收目录。'); await loadList(); } catch (cause) { fail(errorText(cause, '季度删除失败')); } }
  function create() { setDocument(null); setSelected(''); setContent('---\ntitle: 新番季度\ndate: 2027/01/01\ncomments: true\n---\n\n{% 123456 %}\n'); }
  return <Grid container spacing={2}><Grid size={{ xs: 12, lg: 4 }}><Paper variant="outlined"><Stack direction="row" sx={{ p: 1.5 }}><Typography variant="h6" sx={{ flex: 1 }}>季度文件</Typography><Button startIcon={<AddOutlined />} onClick={create}>新建</Button></Stack><Divider /><List>{seasons.map((item) => <ListItemButton key={item.id} selected={selected === item.id} onClick={() => void choose(item.id)}><ListItemText primary={item.id} secondary={`${item.size} bytes`} /></ListItemButton>)}</List></Paper></Grid><Grid size={{ xs: 12, lg: 8 }}><Paper variant="outlined" sx={{ p: 2.5 }}>
    {!document && <TextField label="新季度路径" placeholder="2027/1月.md" value={newId} onChange={(event) => setNewId(event.target.value)} fullWidth sx={{ mb: 2 }} />}
    <TextField label="季度 Markdown" value={content} onChange={(event) => setContent(event.target.value)} multiline minRows={24} fullWidth sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }} />
    <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}><Button variant="contained" startIcon={<SaveOutlined />} onClick={save}>保存</Button>{document && <Button color="error" startIcon={<DeleteOutline />} onClick={remove}>删除</Button>}</Stack>
  </Paper></Grid></Grid>;
}

function Albums({ report, notify, fail }: { report: ProjectReport; notify: (value: string) => void; fail: (value: string) => void }) {
  const [albums, setAlbums] = useState<AlbumRecord[]>([]); const [selected, setSelected] = useState(''); const [infoText, setInfoText] = useState(''); const [newId, setNewId] = useState(''); const [upload, setUpload] = useState<File | null>(null);
  const album = useMemo(() => albums.find((item) => item.id === selected), [albums, selected]);
  const load = useCallback(async () => { try { const data = await api<{ albums: AlbumRecord[] }>('/api/feature/albums'); setAlbums(data.albums); } catch (cause) { fail(errorText(cause, '相册读取失败')); } }, [fail]);
  useEffect(() => { void load(); }, [load]);
  function choose(item: AlbumRecord) { setSelected(item.id); setNewId(''); setInfoText(JSON.stringify(item.info, null, 2)); }
  function create() { setSelected(''); setNewId(''); setInfoText(JSON.stringify({ title: '新相册', description: '', date: new Date().toISOString().slice(0, 10), location: '', tags: [], layout: 'grid', columns: 3, hidden: false }, null, 2)); }
  async function save() { const id = album?.id ?? newId; if (!id) return fail('请输入相册 ID'); try { const info = JSON.parse(infoText) as Record<string, unknown>; const result = await api<{ albums: { albums: AlbumRecord[] } }>('/api/feature/album', json('PUT', { id, info, version: album?.version ?? '' })); setAlbums(result.albums.albums); const next = result.albums.albums.find((item) => item.id === id); if (next) choose(next); notify('相册信息已保存。'); } catch (cause) { fail(errorText(cause, '相册保存失败')); } }
  async function remove() { if (!album) return; try { await api('/api/feature/album', json('DELETE', { id: album.id, version: album.version })); setSelected(''); setInfoText(''); notify('相册目录已移入回收目录。'); await load(); } catch (cause) { fail(errorText(cause, '相册删除失败')); } }
  async function uploadPhoto() { if (!album || !upload) return; const form = new FormData(); form.set('scope', 'public'); form.set('folder', `albums/${album.id}`); form.set('file', upload); try { await api('/api/media', { method: 'POST', body: form }); setUpload(null); notify('相册图片已上传。'); await load(); } catch (cause) { fail(errorText(cause, '图片上传失败')); } }
  async function deletePhoto(photo: string) { if (!album) return; try { await api('/api/media', json('DELETE', { scope: 'public', path: `albums/${album.id}/${photo}` })); notify('相册图片已移入回收目录。'); await load(); } catch (cause) { fail(errorText(cause, '图片删除失败')); } }
  return <Grid container spacing={2}><Grid size={{ xs: 12, lg: 4 }}><Paper variant="outlined"><Stack direction="row" sx={{ p: 1.5 }}><Typography variant="h6" sx={{ flex: 1 }}>相册</Typography><Button startIcon={<AddOutlined />} onClick={create}>新建</Button></Stack><Divider /><List>{albums.map((item) => <ListItemButton key={item.id} selected={selected === item.id} onClick={() => choose(item)}><ListItemText primary={String(item.info.title ?? item.id)} secondary={`${item.id} · ${item.photos.length} 个本地图片`} /><Chip size="small" color={item.complete ? 'success' : 'warning'} label={item.complete ? '完整' : '待补全'} /></ListItemButton>)}</List></Paper></Grid><Grid size={{ xs: 12, lg: 8 }}><Paper variant="outlined" sx={{ p: 2.5 }}>
    {!album && <TextField label="新相册 ID" value={newId} onChange={(event) => setNewId(event.target.value)} fullWidth sx={{ mb: 2 }} />}
    <TextField label="info.json" value={infoText} onChange={(event) => setInfoText(event.target.value)} multiline minRows={20} fullWidth sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }} />
    <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}><Button variant="contained" startIcon={<SaveOutlined />} onClick={save} disabled={report.readOnly}>保存</Button>{album && <Button color="error" startIcon={<DeleteOutline />} onClick={remove}>删除相册</Button>}</Stack>
    {album && album.info.mode !== 'external' && <Box sx={{ mt: 3 }}><Typography variant="h6">本地图片</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>封面文件需命名为 cover.webp 或 cover.jpg；其他支持格式将作为照片。删除操作会先移入面板回收目录。</Typography><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>{album.photos.map((photo) => <Chip key={photo} label={photo} onDelete={report.readOnly ? undefined : () => void deletePhoto(photo)} />)}</Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><Button component="label" variant="outlined" startIcon={<UploadOutlined />}>{upload?.name ?? '选择图片'}<input hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" onChange={(event) => setUpload(event.target.files?.[0] ?? null)} /></Button><Button onClick={uploadPhoto} disabled={!upload}>上传</Button></Stack></Box>}
  </Paper></Grid></Grid>;
}

function LoadingPaper() { return <Paper variant="outlined" sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Paper>; }
