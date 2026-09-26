import { FormEvent, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';
import { api, json } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/api/auth/login', json('POST', { token })); navigate('/', { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '登录失败'); }
    finally { setBusy(false); }
  }
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, background: 'linear-gradient(145deg,#eef2ff,#f8fafc 55%,#ecfeff)' }}>
    <Paper elevation={8} sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 5 } }}>
      <Stack spacing={3} component="form" onSubmit={submit}>
        <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'primary.main', color: 'white', display: 'grid', placeItems: 'center' }}><LockOutlined /></Box>
        <Box><Typography variant="h4">登录 MizukiPanel</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>输入本次启动时终端显示的访问令牌。</Typography></Box>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="访问令牌" value={token} onChange={(event) => setToken(event.target.value)} autoFocus fullWidth type="password" required />
        <Button variant="contained" size="large" type="submit" disabled={busy}>{busy ? '验证中…' : '进入面板'}</Button>
      </Stack>
    </Paper>
  </Box>;
}
