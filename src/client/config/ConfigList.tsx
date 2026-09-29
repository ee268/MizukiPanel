import { Box, Divider, List, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import type { ConfigDescriptor } from "../types";

interface ConfigListProps {
  groups: Record<string, ConfigDescriptor[]>;
  selected: string;
  onSelect: (key: string) => void;
}

export function ConfigList({ groups, selected, onSelect }: ConfigListProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        position: { md: "sticky" },
        top: { md: 88 },
        maxHeight: { md: "calc(100vh - 112px)" },
        overflow: "auto",
      }}
    >
      {Object.entries(groups).map(([group, items], index) => (
        <Box key={group}>
          {index > 0 && <Divider />}
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: "block", px: 2, pt: 1.5 }}
          >
            {group}
          </Typography>
          <List dense disablePadding sx={{ pb: 1 }}>
            {items.map((item) => (
              <ListItemButton
                key={item.key}
                selected={selected === item.key}
                onClick={() => onSelect(item.key)}
              >
                <ListItemText
                  primary={item.label}
                  secondary={item.key}
                  slotProps={{
                    secondary: { sx: { fontFamily: "monospace", fontSize: 10 } },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ))}
    </Paper>
  );
}
