import type { ReactNode } from "react";
import { Paper, Stack, Typography } from "@mui/material";
import type { ArchiveItem } from "../../shared/maintenance";
export const archiveSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
export function ArchiveRow({ item, children }: { item: ArchiveItem; children?: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack spacing={1}>
        <Typography sx={{ overflowWrap: "anywhere" }}>{item.originalPath}</Typography>
        <Typography variant="body2" color="text.secondary">
          {item.kind === "backup" ? "保存备份" : "回收项"} · {item.projectName} ·{" "}
          {new Date(item.createdAt).toLocaleString()} · {archiveSize(item.bytes)}
        </Typography>
        {(item.reason || item.protected) && (
          <Typography variant="body2" color="text.secondary">
            {item.reason || "最新恢复点，保留并禁止清理。"}
          </Typography>
        )}
        {children}
      </Stack>
    </Paper>
  );
}
