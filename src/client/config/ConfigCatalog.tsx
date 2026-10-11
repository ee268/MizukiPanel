import { lazy, Suspense } from "react";
import { CatalogSearchPanel, CatalogGrid, CatalogEmptyState } from "../components/CatalogLayout";
import { Box, Divider, Stack, Typography } from "@mui/material";
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
      <CatalogSearchPanel
        summary={query ? `找到 ${count} 项配置` : `${count} 项配置 · 选择卡片开始编辑`}
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
      </CatalogSearchPanel>
      {matches.map(({ group, items }) => (
        <Box component="section" key={group} aria-label={group}>
          <Divider textAlign="left" sx={{ mb: 2 }}>
            <Typography variant="h6" component="h2">
              {group}
            </Typography>
          </Divider>
          <CatalogGrid>
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
          </CatalogGrid>
        </Box>
      ))}
      {!matches.length && (
        <CatalogEmptyState message="没有找到匹配的配置" onClear={() => onQueryChange("")} />
      )}
    </Stack>
  );
}
