import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container, Grid, List, ListItem,
  Paper, Stack, TextField, Typography
} from '@mui/material';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import LinkOffOutlined from '@mui/icons-material/LinkOffOutlined';
import { api, json } from '../api';
import type { GitStatus, ProjectReport } from '../types';

interface WorkspaceData { connectedPath: string | null; report: ProjectReport | null; gitStatus: GitStatus | null; connectionError: string | null }
const modeLabel = { local: '本地内容', external: '独立内容仓库', blocked: '配置待确认' };

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const next = await api<WorkspaceData>('/api/workspace'); setData(next); setProjectPath(next.connectedPath ?? ''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '工作区读取失败'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function connect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/api/workspace/connect', json('POST', { projectPath })); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '连接失败'); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setError('');
    try { await api('/api/workspace/disconnect', json('POST')); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '断开失败'); }
    finally { setBusy(false); }
  }
  return <Container maxWidth="xl" sx={{ py: 4 }}>
    <Stack spacing={3}>
      <Box><Typography variant="h4">项目工作区</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>连接本机 Mizuki 根目录，查看内容来源和 Git 状态。</Typography></Box>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={2} onSubmit={connect} sx={{ alignItems: 'flex-start' }}>
          <TextField label="Mizuki 项目绝对路径" value={projectPath} onChange={(event) => setProjectPath(event.target.value)} placeholder="C:\\sites\\Mizuki" required fullWidth />
          <Button variant="contained" type="submit" startIcon={<FolderOpenOutlined />} disabled={busy} sx={{ minWidth: 150, height: 40 }}>{data?.report ? '重新连接' : '连接项目'}</Button>
          {data?.connectedPath && <Button color="error" variant="outlined" onClick={disconnect} startIcon={<LinkOffOutlined />} disabled={busy} sx={{ minWidth: 120, height: 40 }}>断开</Button>}
        </Stack>
      </Paper>
      {(error || data?.connectionError) && <Alert severity="error">{error || `已保存的项目无法读取：${data?.connectionError}`}</Alert>}
      {data?.report && <>
        {data.report.warnings.map((warning) => <Alert key={warning} severity={data.report?.readOnly ? 'warning' : 'info'}>{warning}</Alert>)}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}><Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">内容模式</Typography><Typography variant="h5" sx={{ mt: 1 }}>{modeLabel[data.report.mode]}</Typography><Chip sx={{ mt: 2 }} size="small" color={data.report.readOnly ? 'warning' : 'success'} label={data.report.readOnly ? '只读' : '可写'} /></CardContent></Card></Grid>
          <Grid size={{ xs: 12, sm: 8 }}><Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">Mizuki 根目录</Typography><Typography sx={{ mt: 1, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{data.report.root}</Typography></CardContent></Card></Grid>
        </Grid>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography variant="h6">内容仓库 Git 状态</Typography><Button size="small" startIcon={<RefreshOutlined />} onClick={load}>刷新</Button></Stack>
          {data.gitStatus ? <><Typography sx={{ mt: 1 }}>分支：<Box component="span" sx={{ fontFamily: 'monospace' }}>{data.gitStatus.branch ?? '游离 HEAD'}</Box> · 未提交：{data.gitStatus.changes.length} · 领先：{data.gitStatus.ahead} · 落后：{data.gitStatus.behind}</Typography>
            <List dense>{data.gitStatus.changes.slice(0, 20).map((change) => <ListItem key={`${change.status}-${change.path}`} sx={{ fontFamily: 'monospace', fontSize: 13 }}>{change.status} {change.path}</ListItem>)}</List></> : <Typography color="text.secondary" sx={{ mt: 1 }}>未检测到可读取的 Git 仓库。</Typography>}
        </Paper>
        <Box><Typography variant="h5" gutterBottom>原始内容位置</Typography><Grid container spacing={2}>{data.report.mappings.map((mapping) => <Grid size={{ xs: 12, md: 6 }} key={mapping.key}><Card variant="outlined"><CardContent><Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography sx={{ fontWeight: 650 }}>{mapping.label}</Typography><Chip size="small" label={mapping.exists ? '目录存在' : '目录待创建'} /></Stack><Typography variant="body2" sx={{ mt: 2, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{mapping.sourcePath}</Typography>{mapping.resolvedPath && <Typography variant="caption" color="text.secondary">实际指向：{mapping.resolvedPath}</Typography>}{mapping.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{mapping.note}</Typography>}</CardContent></Card></Grid>)}</Grid></Box>
      </>}
      {data && !data.report && !data.connectionError && <Alert severity="info">连接项目后可管理文章、媒体并启动真实 Astro 预览。</Alert>}
    </Stack>
  </Container>;
}
