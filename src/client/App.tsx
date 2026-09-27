import { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react';
import {
  AppBar, Box, Button, CircularProgress, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Popover, Slider,
  Stack, ToggleButton, ToggleButtonGroup, Toolbar, Typography, useMediaQuery, useTheme
} from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import PermMediaOutlined from '@mui/icons-material/PermMediaOutlined';
import PreviewOutlined from '@mui/icons-material/PreviewOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api';
import { hueColor, usePanelTheme, type PanelColorMode } from './theme';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'));
const MediaPage = lazy(() => import('./pages/MediaPage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));

const drawerWidth = 248;
const navigation = [
  { path: '/', label: '工作区', icon: <DashboardOutlined /> },
  { path: '/articles', label: '文章管理', icon: <ArticleOutlined /> },
  { path: '/config', label: '站点配置', icon: <TuneOutlined /> },
  { path: '/features', label: '特色页面', icon: <AutoAwesomeOutlined /> },
  { path: '/media', label: '媒体管理', icon: <PermMediaOutlined /> },
  { path: '/preview', label: '真实预览', icon: <PreviewOutlined /> }
];

function ThemeSettings() {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const { hue, mode, setHue, setMode, reset } = usePanelTheme();
  const modes: Array<{ value: PanelColorMode; label: string }> = [
    { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }, { value: 'system', label: '跟随系统' }
  ];
  return <>
    <IconButton aria-label="面板主题设置" title="面板主题设置" aria-haspopup="true" aria-expanded={Boolean(anchorElement)}
      onClick={(event: MouseEvent<HTMLElement>) => setAnchorElement(event.currentTarget)}><PaletteOutlined /></IconButton>
    <Popover open={Boolean(anchorElement)} anchorEl={anchorElement} onClose={() => setAnchorElement(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 340, maxWidth: 'calc(100vw - 24px)', p: 2.5, mt: 1 } } }}>
        <Stack spacing={3}>
          <Typography variant="h6">面板主题</Typography>
          <Box>
            <Typography gutterBottom>显示模式</Typography>
            <ToggleButtonGroup exclusive fullWidth value={mode} onChange={(_, value: PanelColorMode | null) => value && setMode(value)}>
              {modes.map((item) => <ToggleButton key={item.value} value={item.value}>{item.label}</ToggleButton>)}
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>主题色相</Typography><Typography variant="body2" color="text.secondary">{hue}°</Typography>
            </Stack>
            <Slider value={hue} min={0} max={360} step={1} onChange={(_, value) => setHue(value as number)} aria-label="主题色相" />
            <Box sx={{ height: 36, borderRadius: 2, background: `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, index) => hueColor(index * 30)).join(', ')})` }} />
          </Box>
          <Button onClick={reset} sx={{ alignSelf: 'flex-start' }}>恢复默认</Button>
        </Stack>
    </Popover>
  </>;
}

function RequireAuth() {
  const [state, setState] = useState<'loading' | 'ready' | 'login'>('loading');
  useEffect(() => { api('/api/session').then(() => setState('ready')).catch(() => setState('login')); }, []);
  if (state === 'loading') return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (state === 'login') return <Navigate to="/login" replace />;
  return <AppShell />;
}

function AppShell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const routeLocation = useLocation();
  const current = navigation.find((item) => item.path === '/' ? routeLocation.pathname === '/' : routeLocation.pathname.startsWith(item.path));
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }
  const drawer = <>
    <Toolbar sx={{ px: 2.5 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 800, mr: 1.5 }}>M</Box>
      <Box><Typography sx={{ fontWeight: 750 }}>MizukiPanel</Typography><Typography variant="caption" color="text.secondary">本机博客管理</Typography></Box>
    </Toolbar>
    <Divider />
    <List sx={{ p: 1.5 }}>
      {navigation.map((item) => <ListItemButton key={item.path} component={NavLink} to={item.path} end={item.path === '/'}
        onClick={() => setOpen(false)} sx={{ borderRadius: 2, mb: .5, '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } } }}>
        <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon><ListItemText primary={item.label} />
      </ListItemButton>)}
    </List>
  </>;
  return <Box sx={{ display: 'flex', minHeight: '100vh' }}>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', zIndex: theme.zIndex.drawer + 1, ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
      <Toolbar><IconButton onClick={() => setOpen(true)} sx={{ display: { md: 'none' }, mr: 1 }}><MenuIcon /></IconButton><Typography variant="h6">{current?.label ?? 'MizukiPanel'}</Typography><Box sx={{ flex: 1 }} /><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, mr: 1 }}>React · Material UI</Typography><ThemeSettings /><IconButton aria-label="退出登录" title="退出登录" onClick={logout}><LogoutOutlined /></IconButton></Toolbar>
    </AppBar>
    <Drawer variant={desktop ? 'permanent' : 'temporary'} open={desktop || open} onClose={() => setOpen(false)}
      sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}>{drawer}</Drawer>
    <Box component="main" sx={{ flexGrow: 1, minWidth: 0, pt: 8, ml: { md: 0 } }}><Outlet /></Box>
  </Box>;
}

export default function App() {
  return <Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<RequireAuth />}>
      <Route path="/" element={<WorkspacePage />} />
      <Route path="/articles" element={<ArticlesPage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/media" element={<MediaPage />} />
      <Route path="/preview" element={<PreviewPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>;
}
