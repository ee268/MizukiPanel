import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActions, CardContent, CardMedia, Chip, Container, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, MenuItem, Paper, Snackbar,
  Stack, Tab, Tabs, TextField, Typography
} from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { api, json } from '../api';
import type { MediaItem, ProjectReport } from '../types';

interface MediaData { report: ProjectReport; media: MediaItem[]; articles: Array<{ id: string; title: string }> }
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function MediaPage() {
  const [data, setData] = useState<MediaData | null>(null);
  const [scope, setScope] = useState<'public' | 'article'>('public');
  const [query, setQuery] = useState('');
  const [articleId, setArticleId] = useState('');
  const [folder, setFolder] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const next = await api<MediaData>('/api/media'); setData(next); setArticleId((current) => current || next.articles[0]?.id || ''); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '媒体读取失败'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => data?.media.filter((item) => item.scope === scope && item.path.toLowerCase().includes(query.trim().toLowerCase())) ?? [], [data, scope, query]);
  async function upload(event: FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setError('');
    const form = new FormData(); form.set('scope', scope); form.set('articleId', articleId); form.set('folder', folder); form.set('file', file);
    try { const result = await api<{ reference: string }>('/api/media', { method: 'POST', body: form }); setNotice(`上传成功：${result.reference}`); setFile(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '上传失败'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return; setBusy(true); setError('');
    try { await api('/api/media', json('DELETE', { scope: deleting.scope, path: deleting.path })); setDeleting(null); setNotice('媒体已移入回收目录'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败'); }
    finally { setBusy(false); }
  }
  async function copy(reference: string) { await navigator.clipboard.writeText(reference); setNotice(`已复制：${reference}`); }
  return <Container maxWidth="xl" sx={{ py: 4 }}><Stack spacing={3}>
    <Box><Typography variant="h4">媒体管理</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>管理公共图片和与文章同目录的相对资源。</Typography></Box>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}{data?.report.readOnly && <Alert severity="warning">当前工作区只读，媒体写入已禁用。</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6" gutterBottom>上传图片</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>支持 PNG、JPEG、GIF、WebP、AVIF，最大 20 MB；不会覆盖同名文件。</Typography>
      <Box component="form" onSubmit={upload}><Grid container spacing={2} sx={{ alignItems: 'center' }}><Grid size={{ xs: 12, md: 3 }}><TextField select label="存储位置" value={scope} onChange={(event) => setScope(event.target.value as 'public' | 'article')} fullWidth><MenuItem value="public">公共图片 /images/</MenuItem><MenuItem value="article">文章相对资源</MenuItem></TextField></Grid>{scope === 'article' && <Grid size={{ xs: 12, md: 4 }}><TextField select label="所属文章" value={articleId} onChange={(event) => setArticleId(event.target.value)} fullWidth required>{data?.articles.map((article) => <MenuItem value={article.id} key={article.id}>{article.title} · {article.id}</MenuItem>)}</TextField></Grid>}<Grid size={{ xs: 12, md: 3 }}><TextField label="子目录（可留空）" value={folder} onChange={(event) => setFolder(event.target.value)} fullWidth /></Grid><Grid size={{ xs: 12, md: 4 }}><Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />} fullWidth sx={{ height: 40, justifyContent: 'flex-start' }}>{file?.name ?? '选择图片'}<input hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Button></Grid><Grid size={{ xs: 12, md: 2 }}><Button type="submit" variant="contained" disabled={!file || busy || data?.report.readOnly || (scope === 'article' && !articleId)} fullWidth>上传</Button></Grid></Grid></Box>
    </Paper>
    <Paper variant="outlined"><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ px: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}><Tabs value={scope} onChange={(_, value) => setScope(value)}><Tab value="public" label="公共图片" /><Tab value="article" label="文章资源" /></Tabs><TextField placeholder="筛选文件路径" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ my: 1, width: { sm: 280 } }} /></Stack></Paper>
    <Grid container spacing={2}>{visible.map((item) => <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={`${item.scope}-${item.path}`}><Card variant="outlined"><CardMedia component="img" image={`/api/media/file?scope=${item.scope}&path=${encodeURIComponent(item.path)}`} sx={{ height: 180, objectFit: 'contain', bgcolor: 'grey.100' }} /><CardContent><Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', minHeight: 42 }}>{item.path}</Typography><Stack direction="row" sx={{ mt: 1, justifyContent: 'space-between' }}><Typography variant="caption" color="text.secondary">{formatSize(item.size)}</Typography><Chip size="small" color={item.referencedBy.length ? 'info' : 'default'} label={`${item.referencedBy.length} 处引用`} /></Stack></CardContent><CardActions><Button size="small" startIcon={<ContentCopyOutlined />} onClick={() => copy(item.reference)}>复制引用</Button><Button size="small" color="error" startIcon={<DeleteOutline />} disabled={Boolean(item.referencedBy.length) || data?.report.readOnly} onClick={() => setDeleting(item)}>删除</Button></CardActions></Card></Grid>)}</Grid>
    {!visible.length && <Alert severity="info">当前范围没有匹配的媒体。</Alert>}
    <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)}><DialogTitle>删除媒体</DialogTitle><DialogContent><DialogContentText>文件会先移入面板回收目录：{deleting?.path}</DialogContentText></DialogContent><DialogActions><Button onClick={() => setDeleting(null)}>取消</Button><Button color="error" variant="contained" onClick={remove} disabled={busy}>确认删除</Button></DialogActions></Dialog>
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Stack></Container>;
}
