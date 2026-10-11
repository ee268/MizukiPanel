import { Box, Card, CardContent, Container, Grid, Skeleton, Stack } from "@mui/material";

const reducedMotion = {
  "@media (prefers-reduced-motion: reduce)": {
    "& .MuiSkeleton-root": { animation: "none" },
  },
};

export function MetricSkeleton() {
  return (
    <Card variant="outlined" sx={{ height: "100%", ...reducedMotion }}>
      <CardContent>
        <Skeleton width="45%" />
        <Skeleton variant="text" width="30%" sx={{ fontSize: "2.5rem", mt: 0.5 }} />
        <Skeleton width="70%" sx={{ mt: 1 }} />
      </CardContent>
    </Card>
  );
}

export function WorkspaceLoading() {
  return (
    <Container
      maxWidth="xl"
      sx={{ py: 4, ...reducedMotion }}
      role="status"
      aria-label="正在加载工作区"
    >
      <Stack spacing={3} aria-hidden="true">
        <Box>
          <Skeleton width="35%" sx={{ maxWidth: 260, fontSize: "2rem" }} />
          <Skeleton width="70%" sx={{ maxWidth: 480 }} />
        </Box>
        <Card variant="outlined">
          <CardContent>
            <Skeleton width="25%" sx={{ maxWidth: 180 }} />
            <Skeleton variant="rounded" height={56} sx={{ mt: 2 }} />
            <Skeleton variant="rounded" width={130} height={36} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
        <Box>
          <Skeleton width={160} sx={{ fontSize: "1.5rem" }} />
          <Skeleton width="65%" sx={{ maxWidth: 420 }} />
        </Box>
        <Grid container spacing={2}>
          {Array.from({ length: 4 }, (_, index) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={index}>
              <MetricSkeleton />
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
