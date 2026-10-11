import BuildOutlined from "@mui/icons-material/BuildOutlined";
import AccountTreeOutlined from "@mui/icons-material/AccountTreeOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { Alert, Button, Chip, Divider, Link, Paper, Stack, Typography } from "@mui/material";
import type { PublishOverview } from "../types";

function remoteLink(value: string) {
  if (value.includes("***@")) return null;
  const normalized = value
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/\.git$/, "");
  try {
    const url = new URL(normalized);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function PublishRepository({
  overview,
  disabled,
  onBuild,
}: {
  overview: PublishOverview;
  disabled: boolean;
  onBuild: () => void;
}) {
  return (
    <Stack data-page-motion="aside" spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <AccountTreeOutlined color="primary" />
            <Typography variant="h6">当前提交分支</Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 650, overflowWrap: "anywhere" }}>
            {overview.repositoryAvailable ? (overview.branch ?? "游离 HEAD") : "仓库不可用"}
          </Typography>
          {overview.head && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontFamily: "var(--mizuki-panel-font-mono)", overflowWrap: "anywhere" }}
            >
              HEAD {overview.head.slice(0, 12)}
            </Typography>
          )}
          <Divider />
          <Typography color="text.secondary" variant="body2">
            Mizuki 项目目录
          </Typography>
          <Typography sx={{ overflowWrap: "anywhere" }}>{overview.repositoryRoot}</Typography>
          <Typography variant="body2" color="text.secondary">
            上游：{overview.upstream ?? "未配置"}
          </Typography>
          {overview.upstream && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip size="small" label={`领先 ${overview.ahead} 个提交`} />
              <Chip size="small" label={`落后 ${overview.behind} 个提交`} />
            </Stack>
          )}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          远程仓库
        </Typography>
        <Stack spacing={2}>
          {overview.remotes.length ? (
            overview.remotes.map((remote) => (
              <Stack spacing={0.5} key={remote.name}>
                <Typography sx={{ fontWeight: 650 }}>{remote.name}</Typography>
                {remote.fetchUrls.map((url, i) => (
                  <RemoteUrl key={`fetch-${i}`} label="读取" url={url} />
                ))}
                {remote.pushUrls.map((url, i) => (
                  <RemoteUrl key={`push-${i}`} label="推送" url={url} />
                ))}
              </Stack>
            ))
          ) : (
            <Typography color="text.secondary">尚未配置远程仓库。</Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            领先与落后数量依据本地远程跟踪记录。
          </Typography>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">Mizuki 构建</Typography>
          <Typography color="text.secondary" variant="body2">
            在当前项目目录运行 pnpm run build，输出实时显示在运行日志中。
          </Typography>
          {overview.buildDisabledReason && (
            <Alert severity="info">{overview.buildDisabledReason}</Alert>
          )}
          <Button
            variant="contained"
            startIcon={<BuildOutlined />}
            disabled={disabled || !overview.canBuild}
            onClick={onBuild}
          >
            构建 Mizuki
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
function RemoteUrl({ label, url }: { label: string; url: string }) {
  const href = remoteLink(url);
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary">
        {label}地址
      </Typography>
      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "flex", alignItems: "center", gap: 0.5, overflowWrap: "anywhere" }}
        >
          {url}
          <OpenInNewOutlined sx={{ fontSize: 14, flexShrink: 0 }} />
        </Link>
      ) : (
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          {url}
        </Typography>
      )}
    </Stack>
  );
}
