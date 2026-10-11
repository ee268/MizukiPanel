import { lazy, Suspense } from "react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import type { ConfigDescriptor } from "../types";
import { filterConfigGroups } from "./catalog";
import { CatalogSearch } from "../components/CatalogSearch";
import { CatalogCardSlot } from "../components/CatalogCardSlot";
const ConfigCard = lazy(() => import("./ConfigCard"));

export function ConfigCatalog({
  groups,
  query,
  onQueryChange,
  onSelect,
}: {
  groups: Record<string, ConfigDescriptor[]>;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (key: string) => void;
}) {
  const matches = filterConfigGroups(groups, query);
  const count = matches.reduce((total, group) => total + group.items.length, 0);
  return (
    <Stack spacing={4}>
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
        <CatalogSearch
          options={Object.values(groups).flat()}
          query={query}
          onQueryChange={onQueryChange}
          findOptions={(value) => filterConfigGroups(groups, value).flatMap(({ items }) => items)}
          describeOption={(item) => `${item.key} · ${item.group}`}
          ariaLabel="搜索站点配置"
          placeholder="搜索配置名称、英文名称或分类…"
          clearLabel="清除配置搜索"
          suggestionsLabel="配置搜索建议"
        />
        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          sx={{ mt: 1, px: 0.5 }}
        >
          {query ? `找到 ${count} 项配置` : `${count} 项配置 · 选择卡片开始编辑`}
        </Typography>
      </Box>
      {matches.map(({ group, items }) => (
        <Box component="section" key={group} aria-label={group}>
          <Divider textAlign="left" sx={{ mb: 2 }}>
            <Typography variant="h6" component="h2">
              {group}
            </Typography>
          </Divider>
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
            {items.map((item) => (
              <CatalogCardSlot
                key={item.key}
                cardKey={item.key}
                kind="config"
                label={`编辑${item.label} ${item.key}`}
                onSelect={() => onSelect(item.key)}
              >
                <Suspense fallback={null}>
                  <ConfigCard item={item} onSelect={onSelect} />
                </Suspense>
              </CatalogCardSlot>
            ))}
          </Box>
        </Box>
      ))}
      {!matches.length && (
        <Stack spacing={2} sx={{ minHeight: 280, alignItems: "center", justifyContent: "center" }}>
          <SearchOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography color="text.secondary">没有找到匹配的配置</Typography>
          <Button onClick={() => onQueryChange("")}>清除搜索</Button>
        </Stack>
      )}
    </Stack>
  );
}
