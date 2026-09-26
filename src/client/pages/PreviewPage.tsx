import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import { useSearchParams } from 'react-router-dom';
import { api, json } from '../api';
import type { PreviewStatus } from '../types';

const labels = { stopped: '未启动', starting: '启动中', running: '运行中', external: '已连接外部服务', failed: '启动失败' };
const colors = { stopped: 'default', starting: 'warning', running: 'success', external: 'info', failed: 'error' } as const;

export default function PreviewPage() {
  const [params] = useSearchParams();
  const [preview, setPreview] = useState<PreviewStatus | null>(null);
  const [pagePath, setPagePath] = useState(params.get('path')?.startsWith('/') ? params.get('path')! : '/');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setPreview(await api<PreviewStatus>('/api/preview/status')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '预览状态读取失败'); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 1500); return () => clearInterval(timer); }, [load]);
  const iframeUrl = useMemo(() => preview ? preview.url.replace(/\/$/, '') + (pagePath.startsWith('/') ? pagePath : `/${pagePath}`) : '', [preview, pagePath]);
  async function start() { setError(''); try { setPreview(await api('/api/preview/start', json('POST'))); } catch (cause) { setError(cause instanceof Error ? cause.message : '启动失败'); } }
  async function stop() { setError(''); try { setPreview(await api('/api/preview/stop', json('POST'))); } catch (cause) { setError(cause instanceof Error ? cause.message : '停止失败'); } }
  const active = preview?.state === 'running' || preview?.state === 'external';
  return <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}><Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}><Box><Typography variant="h4">真实预览</Typography><Typography color="text.secondary">使用 Mizuki 自身的 Astro、MDX 和 Markdown 渲染管线。</Typography></Box>{preview && <Chip color={colors[preview.state]} label={labels[preview.state]} />}</Stack>
    {(error || preview?.error) && <Alert severity="warning">{error || preview?.error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}><Button variant="contained" startIcon={<PlayArrowOutlined />} onClick={start} disabled={preview?.state === 'running' || preview?.state === 'starting' || preview?.state === 'external'}>启动 Astro</Button><Button color="error" variant="outlined" startIcon={<StopOutlined />} onClick={stop} disabled={preview?.state !== 'running' && preview?.state !== 'starting'}>停止</Button><TextField label="预览路径" value={pagePath} onChange={(event) => setPagePath(event.target.value)} fullWidth /><Button component="a" href={iframeUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewOutlined />} disabled={!active}>新窗口</Button></Stack></Paper>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1fr) 380px' }, gap: 2 }}>
      <Paper variant="outlined" sx={{ minHeight: '68vh', overflow: 'hidden' }}>{active ? <Box component="iframe" title="Mizuki Astro 真实预览" src={iframeUrl} sx={{ width: '100%', height: '72vh', border: 0, bgcolor: 'white' }} /> : <Box sx={{ minHeight: '68vh', display: 'grid', placeItems: 'center' }}><Typography color="text.secondary">启动后在此显示真实 Astro 页面。</Typography></Box>}</Paper>
      <Paper sx={{ p: 2, bgcolor: '#111827', color: '#e5e7eb', height: '72vh', overflow: 'auto' }}><Typography sx={{ fontWeight: 650 }} gutterBottom>运行日志</Typography><Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, lineHeight: 1.65 }}>{preview?.logs.join('\n') || '暂无日志'}</Box></Paper>
    </Box>
  </Stack></Container>;
}
