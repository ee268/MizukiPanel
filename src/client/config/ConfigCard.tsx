import { catalogCardStyles, catalogIconStyles } from "../components/catalog-styles";
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
      sx={(theme) => catalogCardStyles(theme, "config-card-icon")}
    >
      <CardActionArea
        data-config-card-action
        aria-label={`编辑${item.label} ${item.key}`}
        onClick={() => onSelect(item.key)}
        sx={{ height: "100%", p: 1.75 }}
      >
        <Stack spacing={1.25}>
          <Avatar className="config-card-icon" variant="rounded" sx={catalogIconStyles}>
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
