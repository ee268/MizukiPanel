import type { ReactNode } from "react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";

export function CatalogSearchPanel({
  children,
  summary,
}: {
  children: ReactNode;
  summary: string;
}) {
  return (
    <Box
      data-page-motion="controls"
      sx={{
        position: "sticky",
        top: "calc(var(--mizuki-panel-header-height, 65px) + 12px)",
        zIndex: 2,
        bgcolor: "background.default",
        borderRadius: 2,
      }}
    >
      {children}
      <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ mt: 1, px: 0.5 }}>
        {summary}
      </Typography>
    </Box>
  );
}

export function CatalogGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "repeat(auto-fill, minmax(220px, 1fr))",
        },
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
}

export function CatalogEmptyState({ message, onClear }: { message: string; onClear: () => void }) {
  return (
    <Stack spacing={2} sx={{ minHeight: 280, alignItems: "center", justifyContent: "center" }}>
      <SearchOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
      <Typography color="text.secondary">{message}</Typography>
      <Button onClick={onClear}>清除搜索</Button>
    </Stack>
  );
}
