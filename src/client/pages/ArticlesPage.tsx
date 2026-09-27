import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Divider, IconButton, InputAdornment, List, ListItemButton, ListItemText, MenuItem,
  Paper, Snackbar, Stack, Tab, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import DriveFileRenameOutline from '@mui/icons-material/DriveFileRenameOutline';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, json } from '../api';
import type { ArticleListItem, ArticleRecord, FrontmatterEntry, ProjectReport } from '../types';

type Filter = 'all' | 'published' | 'draft' | 'invalid';
interface Row extends FrontmatterEntry { rowId: string }
const row = (entry: FrontmatterEntry): Row => ({ ...entry, rowId: crypto.randomUUID() });

export default function ArticlesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('post');
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [article, setArticle] = useState<ArticleRecord | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState<Row[]>([]);
  const [source, setSource] = useState('');
  const [mode, setMode] = useState<'frontmatter' | 'source'>('frontmatter');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(params.has('new'));
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const data = await api<{ report: ProjectReport; articles: ArticleListItem[] }>('/api/articles');
      setReport(data.report); setArticles(data.articles); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文章列表读取失败'); }
  }, []);
  const loadArticle = useCallback(async (id: string) => {
    try {
      const data = await api<{ report: ProjectReport; article: ArticleRecord; previewPath: string | null }>(`/api/article?id=${encodeURIComponent(id)}`);
      setReport(data.report); setArticle(data.article); setFrontmatter(data.article.frontmatter.map(row)); setSource(data.article.source); setPreviewPath(data.previewPath);
      setMode(data.article.error ? 'source' : 'frontmatter'); setError('');
    } catch (cause) { setArticle(null); setError(cause instanceof Error ? cause.message : '文章读取失败'); }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) void loadArticle(selectedId); else setArticle(null); }, [selectedId, loadArticle]);
  useEffect(() => { if (params.has('new')) setCreateOpen(true); }, [params]);

  const visible = useMemo(() => articles.filter((item) => {
    const text = `${item.title} ${item.id}`.toLowerCase();
    const matches = text.includes(query.trim().toLowerCase());
    const state = filter === 'all' || (filter === 'draft' && item.draft) || (filter === 'published' && !item.draft && !item.error) || (filter === 'invalid' && Boolean(item.error));
    return matches && state;
  }), [articles, query, filter]);

  function choose(id: string) { setParams({ post: id }); }
  async function saveFrontmatter() {
    if (!article) return; setBusy(true); setError('');
    try {
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>('/api/article/frontmatter', json('PUT', { id: article.id, version: article.version, entries: frontmatter.map(({ key, value, originalKey }) => ({ key, value, originalKey })) }));
      setArticle(data.article); setFrontmatter(data.article.frontmatter.map(row)); setSource(data.article.source); setPreviewPath(data.previewPath); setNotice('Frontmatter 已保存'); await loadList();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }
  async function saveSource() {
    if (!article) return; setBusy(true); setError('');
    try {
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>('/api/article/source', json('PUT', { id: article.id, version: article.version, source }));
      setArticle(data.article); setFrontmatter(data.article.frontmatter.map(row)); setSource(data.article.source); setPreviewPath(data.previewPath); setNotice('文章源码已保存'); await loadList();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }
  async function createArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = { id: String(form.get('id')), title: String(form.get('title')), published: String(form.get('published')), draft: form.has('draft'), body: String(form.get('body') ?? '') };
    try {
      await api('/api/articles', json('POST', payload)); setCreateOpen(false); await loadList(); choose(payload.id); setNotice('文章已创建');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '创建失败'); }
    finally { setBusy(false); }
  }
  async function renameArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!article) return; setBusy(true); setError('');
    const nextId = String(new FormData(event.currentTarget).get('nextId'));
    try { await api('/api/article/rename', json('POST', { id: article.id, nextId, version: article.version })); setRenameOpen(false); await loadList(); choose(nextId); setNotice('文章已重命名'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '重命名失败'); }
    finally { setBusy(false); }
  }
  async function removeArticle() {
    if (!article) return; setBusy(true); setError('');
    try { await api('/api/article', json('DELETE', { id: article.id, version: article.version })); setDeleteOpen(false); setArticle(null); setParams({}); await loadList(); setNotice('文章已移入回收目录'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败'); }
    finally { setBusy(false); }
  }

  return <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
        <Box><Typography variant="h4">文章管理</Typography><Typography color="text.secondary">{report?.mode === 'external' ? '独立内容仓库' : '本地内容'} · {articles.length} 篇文章</Typography></Box>
        <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)} disabled={report?.readOnly}>新建文章</Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {report?.readOnly && <Alert severity="warning">当前工作区只读，请先在工作区处理配置问题。</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0,1fr)' }, gap: 2, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Stack spacing={1.5} sx={{ p: 2 }}><TextField placeholder="搜索标题或路径" value={query} onChange={(event) => setQuery(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> } }} /><TextField select label="文章状态" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>{[['all','全部'],['published','已发布'],['draft','草稿'],['invalid','需要修复']].map(([value,label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Stack>
          <Divider /><List disablePadding sx={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>{visible.map((item) => <ListItemButton key={item.id} selected={selectedId === item.id} onClick={() => choose(item.id)} alignItems="flex-start" sx={{ py: 1.5 }}><ListItemText primary={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Typography variant="body2" sx={{ flex: 1, fontWeight: 650 }}>{item.title}</Typography>{item.error ? <Chip size="small" color="error" label="异常" /> : item.draft ? <Chip size="small" color="warning" label="草稿" /> : null}</Stack>} secondary={<><Typography component="span" variant="caption" sx={{ display: 'block', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{item.id}</Typography>{item.published}</>} /></ListItemButton>)}</List>
        </Paper>
        {!article ? <Paper variant="outlined" sx={{ p: 8, textAlign: 'center' }}><Typography variant="h5">选择一篇文章</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>编辑可改名的 Frontmatter 键值行或完整 Markdown/MDX 源码。</Typography></Paper> :
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                <Box><Typography variant="h5">{article.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{article.id} · {article.format.toUpperCase()}</Typography></Box>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>{previewPath && <Button startIcon={<OpenInNewOutlined />} onClick={() => navigate(`/preview?path=${encodeURIComponent(previewPath)}`)}>真实预览</Button>}<Button startIcon={<DriveFileRenameOutline />} onClick={() => setRenameOpen(true)}>重命名</Button><Button color="error" startIcon={<DeleteOutline />} onClick={() => setDeleteOpen(true)}>删除</Button></Stack>
              </Stack>
              {article.error && <Alert severity="error">Frontmatter 需要修复：{article.error}。请使用源码模式编辑。</Alert>}
              <Tabs value={article.error ? 'source' : mode} onChange={(_, value) => setMode(value)} sx={{ px: 2 }}><Tab value="frontmatter" label="Frontmatter" disabled={Boolean(article.error)} /><Tab value="source" label="完整源码" /></Tabs><Divider />
              {mode === 'frontmatter' && !article.error ? <Box sx={{ p: { xs: 2, md: 3 } }}>
                <Stack direction="row" sx={{ px: 1, pb: 1, display: { xs: 'none', sm: 'flex' } }}><Typography variant="caption" color="text.secondary" sx={{ width: '32%' }}>字段名</Typography><Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>字段内容（YAML）</Typography></Stack>
                <Stack spacing={1.5}>{frontmatter.map((entry) => <Stack key={entry.rowId} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <TextField aria-label="Frontmatter 字段名" value={entry.key} onChange={(event) => setFrontmatter((rows) => rows.map((item) => item.rowId === entry.rowId ? { ...item, key: event.target.value } : item))} placeholder="字段名" sx={{ width: { xs: '38%', sm: '32%' } }} />
                  <TextField aria-label={`${entry.key || '未命名'} 字段内容`} value={entry.value} onChange={(event) => setFrontmatter((rows) => rows.map((item) => item.rowId === entry.rowId ? { ...item, value: event.target.value } : item))} placeholder="YAML 内容，如 true、[tag1, tag2] 或文本" multiline minRows={1} maxRows={8} fullWidth />
                  <Tooltip title="删除字段"><IconButton color="error" onClick={() => setFrontmatter((rows) => rows.filter((item) => item.rowId !== entry.rowId))}><DeleteOutline /></IconButton></Tooltip>
                </Stack>)}</Stack>
                <Stack direction="row" sx={{ mt: 2, justifyContent: 'space-between' }}><Button startIcon={<AddOutlined />} onClick={() => setFrontmatter((rows) => [...rows, row({ key: '', value: '' })])}>添加字段</Button><Button variant="contained" startIcon={<SaveOutlined />} onClick={saveFrontmatter} disabled={busy || report?.readOnly}>保存 Frontmatter</Button></Stack>
                <Alert severity="info" sx={{ mt: 2 }}>字段内容按 YAML 解析。字符串可直接填写；数组可填写 <code>[tag1, tag2]</code>，布尔值填写 <code>true</code> 或 <code>false</code>。字段名和内容都可修改。</Alert>
              </Box> : <Box sx={{ p: { xs: 2, md: 3 } }}><TextField label="完整文章源码" value={source} onChange={(event) => setSource(event.target.value)} fullWidth multiline minRows={24} spellCheck={false} slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 14, lineHeight: 1.6 } } }} /><Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<SaveOutlined />} onClick={saveSource} disabled={busy || report?.readOnly}>保存源码</Button></Stack></Box>}
            </Paper>
          </Stack>}
      </Box>
    </Stack>

    <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md"><Box component="form" onSubmit={createArticle}><DialogTitle>新建文章</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField name="id" label="文章文件路径" placeholder="notes/my-post.md" required /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField name="title" label="标题" required fullWidth /><TextField name="published" label="发布日期" defaultValue={new Date().toISOString().slice(0,10)} required fullWidth /></Stack><TextField name="body" label="正文（Markdown 或 MDX）" multiline minRows={10} defaultValue="# 开始写作" slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} /><label><input type="checkbox" name="draft" defaultChecked /> 先保存为草稿</label></Stack></DialogContent><DialogActions><Button onClick={() => setCreateOpen(false)}>取消</Button><Button variant="contained" type="submit" disabled={busy}>创建</Button></DialogActions></Box></Dialog>
    <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="sm"><Box component="form" onSubmit={renameArticle}><DialogTitle>重命名文章</DialogTitle><DialogContent><TextField name="nextId" label="相对于 posts 的新路径" defaultValue={article?.id} fullWidth required sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setRenameOpen(false)}>取消</Button><Button variant="contained" type="submit" disabled={busy}>重命名</Button></DialogActions></Box></Dialog>
    <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}><DialogTitle>删除文章</DialogTitle><DialogContent><DialogContentText>文章将移入面板回收目录：{article?.id}</DialogContentText></DialogContent><DialogActions><Button onClick={() => setDeleteOpen(false)}>取消</Button><Button color="error" variant="contained" onClick={removeArticle} disabled={busy}>确认删除</Button></DialogActions></Dialog>
    <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
  </Container>;
}
