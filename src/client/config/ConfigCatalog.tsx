import { lazy, Suspense, useEffect, useRef, useState, type CompositionEvent } from "react";
import { keyframes } from "@emotion/react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Autocomplete,
  Box,
  Button,
  Divider,
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
        height: 144,
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
  const [inputValue, setInputValue] = useState(query);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const composing = useRef(false);
  useEffect(() => {
    if (!composing.current) setInputValue(query);
  }, [query]);
  function changeInput(value: string) {
    // Keep the native input in sync immediately; router updates are asynchronous.
    setInputValue(value);
    if (!composing.current) {
      onQueryChange(value);
      setSuggestionsOpen(Boolean(value.trim()));
    }
  }
  function clearSearch() {
    composing.current = false;
    setSuggestionsOpen(false);
    setInputValue("");
    onQueryChange("");
  }
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
        <Autocomplete<ConfigDescriptor, false, false, true>
          freeSolo
          fullWidth
          value={null}
          inputValue={inputValue}
          open={suggestionsOpen && Boolean(inputValue.trim())}
          openOnFocus
          clearOnBlur={false}
          autoHighlight
          options={Object.values(groups).flat()}
          getOptionLabel={(item) => (typeof item === "string" ? item : item.label)}
          getOptionKey={(item) => (typeof item === "string" ? item : item.key)}
          filterOptions={(_, state) =>
            filterConfigGroups(groups, state.inputValue)
              .flatMap(({ items }) => items)
              .slice(0, 6)
          }
          onOpen={() => {
            if (!composing.current && inputValue.trim()) setSuggestionsOpen(true);
          }}
          onClose={() => setSuggestionsOpen(false)}
          onInputChange={(_, value, reason) => {
            if (reason === "input") changeInput(value);
            else if (reason === "clear") clearSearch();
          }}
          onChange={(_, item) => {
            if (item !== null) changeInput(typeof item === "string" ? item : item.label);
            setSuggestionsOpen(false);
          }}
          clearText="清除配置搜索"
          slotProps={{
            listbox: { "aria-label": "配置搜索建议", sx: { maxHeight: 320 } },
            paper: {
              variant: "outlined",
              sx: { mt: 0.75, borderRadius: 2 },
            },
          }}
          renderOption={({ key, ...props }, item) => (
            <Box component="li" key={key} {...props}>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {item.key} · {item.group}
                </Typography>
              </Stack>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="搜索配置名称、英文名称或分类…"
              slotProps={{
                ...params.slotProps,
                htmlInput: {
                  ...params.slotProps.htmlInput,
                  "aria-label": "搜索站点配置",
                  onCompositionStart: () => {
                    composing.current = true;
                    setSuggestionsOpen(false);
                  },
                  onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
                    composing.current = false;
                    changeInput(event.currentTarget.value);
                  },
                },
                input: {
                  ...params.slotProps.input,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ "& .MuiOutlinedInput-root": { bgcolor: "background.paper", borderRadius: 3 } }}
            />
          )}
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
              <CardSlot key={item.key} item={item} onSelect={onSelect} />
            ))}
          </Box>
        </Box>
      ))}
      {!matches.length && (
        <Stack spacing={2} sx={{ minHeight: 280, alignItems: "center", justifyContent: "center" }}>
          <SearchOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography color="text.secondary">没有找到匹配的配置</Typography>
          <Button onClick={clearSearch}>清除搜索</Button>
        </Stack>
      )}
    </Stack>
  );
}
