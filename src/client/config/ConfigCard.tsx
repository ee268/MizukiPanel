import { Avatar, Card, CardActionArea, Stack, Typography } from "@mui/material";
import type { ConfigDescriptor } from "../types";
import { ConfigIcon } from "./ConfigIcon";

export default function ConfigCard({
  item,
  onSelect,
}: {
  item: ConfigDescriptor;
  onSelect: (key: string) => void;
}) {
  return (
    <Card
      data-config-card={item.key}
      variant="outlined"
      sx={(theme) => ({
        height: "100%",
        borderRadius: "16px",
        transition: theme.transitions.create(["transform", "box-shadow", "border-color"], {
          duration: 220,
        }),
        "@media (hover: hover) and (pointer: fine)": {
          "&:hover": {
            transform: "translateY(-5px)",
            borderColor: "color-mix(in srgb, var(--mui-palette-primary-main) 60%, transparent)",
            boxShadow: `0 12px 30px color-mix(in srgb, var(--mui-palette-primary-${theme.palette.mode === "dark" ? "light" : "main"}) ${theme.palette.mode === "dark" ? "9%" : "12%"}, transparent)`,
            "& .config-card-icon": { transform: "rotate(-8deg) scale(1.08)" },
          },
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" },
          "& .config-card-icon": { transition: "none", transform: "none !important" },
        },
      })}
    >
      <CardActionArea
        data-config-card-action
        aria-label={`编辑${item.label} ${item.key}`}
        onClick={() => onSelect(item.key)}
        sx={{ height: "100%", p: 1.75 }}
      >
        <Stack spacing={1.25}>
          <Avatar
            className="config-card-icon"
            variant="rounded"
            sx={(theme) => ({
              width: 40,
              height: 40,
              borderRadius: "12px",
              bgcolor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
              color: "primary.main",
              transition: theme.transitions.create("transform", { duration: 220 }),
              "& .MuiSvgIcon-root": { fontSize: 24 },
            })}
          >
            <ConfigIcon configKey={item.key} />
          </Avatar>
          <Stack spacing={0.25}>
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontSize: (theme) => theme.typography.pxToRem(16) }}
            >
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {item.key}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
