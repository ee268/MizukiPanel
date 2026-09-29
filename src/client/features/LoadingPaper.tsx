import { CircularProgress, Paper } from "@mui/material";

export function LoadingPaper() {
  return (
    <Paper variant="outlined" sx={{ minHeight: 360, display: "grid", placeItems: "center" }}>
      <CircularProgress />
    </Paper>
  );
}
