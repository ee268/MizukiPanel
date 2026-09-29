import { lazy, Suspense, useCallback, useEffect, useState, type MouseEvent } from 'react';
import {
  AppBar, Avatar, Box, Button, CircularProgress, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Popover, Slider, Tooltip,
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
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { api } from './api';
import type { SiteIdentity } from './types';
import { hueColor, usePanelTheme, type PanelColorMode } from './theme';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'));
const MediaPage = lazy(() => import('./pages/MediaPage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const PublishPage = lazy(() => import('./pages/PublishPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

const drawerWidth = 248;
const collapsedDrawerWidth = 72;
const navigation = [
  { path: '/', label: '工作区', icon: <DashboardOutlined /> },
  { path: '/articles', label: '文章管理', icon: <ArticleOutlined /> },
  { path: '/config', label: '站点配置', icon: <TuneOutlined /> },
  { path: '/features', label: '特色页面', icon: <AutoAwesomeOutlined /> },
  { path: '/media', label: '媒体管理', icon: <PermMediaOutlined /> },
  { path: '/preview', label: '真实预览', icon: <PreviewOutlined /> },
  { path: '/publish', label: '发布管理', icon: <RocketLaunchOutlined /> }
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
  const [collapsed, setCollapsed] = useState(true);
  const [identity, setIdentity] = useState<SiteIdentity>({ title: 'Mizuki', avatarUrl: null });
  const compact = desktop && collapsed;
  const effectiveDrawerWidth = compact ? collapsedDrawerWidth : drawerWidth;
  const loadIdentity = useCallback(async () => {
    try { setIdentity(await api<SiteIdentity>('/api/site-identity')); }
    catch { setIdentity({ title: 'Mizuki', avatarUrl: null }); }
  }, []);
  useEffect(() => {
    const refresh = () => void loadIdentity();
    refresh();
    window.addEventListener('mizuki-site-identity-changed', refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => { window.removeEventListener('mizuki-site-identity-changed', refresh); window.clearInterval(timer); };
  }, [loadIdentity]);
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }
  const drawer = <>
    <Toolbar sx={{ px: compact ? 1 : 2.5, justifyContent: 'center' }}>
      <Box component="img" src="/mizuki-panel-logo.svg" alt="MizukiPanel"
        sx={{ width: compact ? 52 : 174, height: 44, display: 'block', objectFit: 'contain', bgcolor: 'transparent', flexShrink: 0 }} />
    </Toolbar>
    <Divider />
    <List sx={{ p: compact ? 1 : 1.5, flex: 1, overflowY: 'auto' }}>
      {navigation.map((item) => <Tooltip key={item.path} title={compact ? item.label : ''} placement="right">
        <ListItemButton component={NavLink} to={item.path} end={item.path === '/'} aria-label={item.label}
          onClick={() => setOpen(false)} sx={{ borderRadius: 2, justifyContent: compact ? 'center' : 'flex-start', minHeight: 48, mb: .5, px: compact ? 1 : 2, '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } } }}>
          <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: 'center' }}>{item.icon}</ListItemIcon>
          {!compact && <ListItemText primary={item.label} />}
        </ListItemButton>
      </Tooltip>)}
    </List>
    <Box sx={{ mt: 'auto' }}>
      <Divider />
      <Tooltip title={compact ? '关于' : ''} placement="right">
        <ListItemButton component={NavLink} to="/about" aria-label="关于"
          sx={{ justifyContent: compact ? 'center' : 'flex-start', minHeight: 52, px: compact ? 1 : 2.5, '&.active': { color: 'primary.main', bgcolor: 'action.selected', '& .MuiListItemIcon-root': { color: 'inherit' } } }}>
          <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: 'center' }}><InfoOutlined /></ListItemIcon>
          {!compact && <ListItemText primary="关于" />}
        </ListItemButton>
      </Tooltip>
      {desktop && <Tooltip title={compact ? '展开导航栏' : ''} placement="right">
          <ListItemButton aria-label={compact ? '展开导航栏' : '收起导航栏'} onClick={() => setCollapsed((value) => !value)}
            sx={{ justifyContent: compact ? 'center' : 'flex-start', minHeight: 56, px: compact ? 1 : 2.5 }}>
            <ListItemIcon sx={{ minWidth: compact ? 0 : 40, justifyContent: 'center' }}>{compact ? <ChevronRightOutlined /> : <ChevronLeftOutlined />}</ListItemIcon>
            {!compact && <ListItemText primary="收起导航栏" />}
          </ListItemButton>
        </Tooltip>}
    </Box>
  </>;
  return <Box sx={{ display: 'flex', minHeight: '100vh' }}>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', zIndex: theme.zIndex.drawer + 1, ml: { md: effectiveDrawerWidth + 'px' }, width: { md: 'calc(100% - ' + effectiveDrawerWidth + 'px)' }, transition: theme.transitions.create(['margin', 'width']) }}>
      <Toolbar><IconButton onClick={() => setOpen(true)} sx={{ display: { md: 'none' }, mr: 1 }}><MenuIcon /></IconButton><Box sx={{ flex: 1 }} /><Tooltip title="编辑个人资料配置"><IconButton component={NavLink} to="/config?key=profileConfig" aria-label="编辑个人资料配置" sx={{ p: 0, mr: 1 }}><Avatar src={identity.avatarUrl ?? undefined} alt={identity.title} sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 14, fontWeight: 800 }}>M</Avatar></IconButton></Tooltip><Typography variant="body2" color="text.secondary" title={identity.title} sx={{ display: { xs: 'none', sm: 'block' }, mr: 1, maxWidth: { sm: 220, lg: 360 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{identity.title}</Typography><ThemeSettings /><IconButton aria-label="退出登录" title="退出登录" onClick={logout}><LogoutOutlined /></IconButton></Toolbar>
    </AppBar>
    <Drawer variant={desktop ? 'permanent' : 'temporary'} open={desktop || open} onClose={() => setOpen(false)}
      sx={{ width: effectiveDrawerWidth, flexShrink: 0, transition: theme.transitions.create('width'), '& .MuiDrawer-paper': { width: effectiveDrawerWidth, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowX: 'hidden', borderRight: 'none', transition: theme.transitions.create('width') } }}>{drawer}</Drawer>
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
      <Route path="/publish" element={<PublishPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>;
}
