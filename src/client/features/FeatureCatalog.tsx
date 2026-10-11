import { lazy, Suspense } from "react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";
import { CatalogCardSlot } from "../components/CatalogCardSlot";
import { CatalogSearch } from "../components/CatalogSearch";
import type { FeatureModule } from "../types";
import { filterFeatureModules } from "./catalog";

const FeatureCard = lazy(() => import("./FeatureCard"));

export function FeatureCatalog({
  modules,
  query,
  onQueryChange,
  readOnly,
  pending,
  onSelect,
  onToggle,
}: {
  modules: FeatureModule[];
  query: string;
  onQueryChange: (value: string) => void;
  readOnly: boolean;
  pending: { key: string; enabled: boolean } | null;
  onSelect: (key: string) => void;
  onToggle: (module: FeatureModule, enabled: boolean) => void;
}) {
  const matches = filterFeatureModules(modules, query);
  return (
    <Stack spacing={3}>
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
          options={modules}
          query={query}
          onQueryChange={onQueryChange}
          findOptions={(value) => filterFeatureModules(modules, value)}
          describeOption={(item) => `${item.key} · ${item.pagePath}`}
          ariaLabel="搜索特色页面"
          placeholder="搜索页面名称、英文名称或路径…"
        />
        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          sx={{ mt: 1, px: 0.5 }}
        >
          {query
            ? `找到 ${matches.length} 个页面`
            : `${matches.length} 个页面 · 点击卡片编辑，使用开关启用或关闭`}
        </Typography>
      </Box>
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
        {matches.map((module) => (
          <CatalogCardSlot
            key={module.key}
            cardKey={module.key}
            kind="feature"
            label={`编辑${module.label}页面`}
            onSelect={() => onSelect(module.key)}
          >
            <Suspense fallback={null}>
              <FeatureCard
                module={
                  pending?.key === module.key ? { ...module, enabled: pending.enabled } : module
                }
                readOnly={readOnly}
                busy={pending !== null}
                saving={pending?.key === module.key}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            </Suspense>
          </CatalogCardSlot>
        ))}
      </Box>
      {!matches.length && (
        <Stack spacing={2} sx={{ minHeight: 280, alignItems: "center", justifyContent: "center" }}>
          <SearchOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography color="text.secondary">没有找到匹配的特色页面</Typography>
          <Button onClick={() => onQueryChange("")}>清除搜索</Button>
        </Stack>
      )}
    </Stack>
  );
}
