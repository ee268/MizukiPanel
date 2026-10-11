import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { keyframes } from "@emotion/react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ConfigDescriptor } from "../types";
import { filterConfigGroups } from "./catalog";

const ConfigCard = lazy(() => import("./ConfigCard"));
const enter = keyframes`from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; }`;

function CardSlot({ item, onSelect }: { item: ConfigDescriptor; onSelect: (key: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = slot.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Keyboard focus must survive scrolling even when the slot leaves the viewport.
        setVisible(entry.isIntersecting || element.contains(document.activeElement));
      },
      { rootMargin: "0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <Box
      ref={slot}
      data-config-slot={item.key}
      tabIndex={visible ? undefined : 0}
      aria-label={visible ? undefined : `编辑${item.label} ${item.key}`}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          const element = slot.current;
          if (!element || element.contains(document.activeElement)) return;
          const bounds = element.getBoundingClientRect();
          if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) setVisible(false);
        });
      }}
      onFocus={() => {
        if (!visible) {
          slot.current?.scrollIntoView({ block: "center", behavior: "instant" });
          setVisible(true);
        }
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(item.key);
        }
      }}
      sx={{
        height: 190,
        minWidth: 0,
        borderRadius: 3,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 3 },
      }}
    >
      {visible && (
        <Box
          sx={{
            height: "100%",
            animation: `${enter} 330ms cubic-bezier(.2,.7,.2,1)`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <Suspense fallback={null}>
            <ConfigCard item={item} onSelect={onSelect} />
          </Suspense>
        </Box>
      )}
    </Box>
  );
}

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
        <TextField
          fullWidth
          placeholder="搜索配置名称、英文名称或分类…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索站点配置"
          slotProps={{
            htmlInput: { "aria-label": "搜索站点配置" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="清除配置搜索"
                    onClick={() => onQueryChange("")}
                    edge="end"
                  >
                    <CloseOutlined />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
          sx={{ "& .MuiOutlinedInput-root": { bgcolor: "background.paper", borderRadius: 3 } }}
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
          <Divider textAlign="left" sx={{ mb: 2.5 }}>
            <Typography variant="h6" component="h2">
              {group}
            </Typography>
          </Divider>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2.5,
            }}
          >
            {items.map((item) => (
              <CardSlot key={item.key} item={item} onSelect={onSelect} />
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
