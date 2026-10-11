import { lazy, Suspense } from "react";
import { CatalogSearchPanel, CatalogGrid, CatalogEmptyState } from "../components/CatalogLayout";
import { Stack } from "@mui/material";
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
      <CatalogSearchPanel
        summary={
          query
            ? `找到 ${matches.length} 个页面`
            : `${matches.length} 个页面 · 点击卡片编辑，使用开关启用或关闭`
        }
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
      </CatalogSearchPanel>
      <CatalogGrid>
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
      </CatalogGrid>
      {!matches.length && (
        <CatalogEmptyState message="没有找到匹配的特色页面" onClear={() => onQueryChange("")} />
      )}
    </Stack>
  );
}
