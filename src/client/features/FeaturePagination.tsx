import { TablePagination } from "@mui/material";
import type { useFeaturePagination } from "./useFeaturePagination";

export function FeaturePagination({
  count,
  pagination,
}: {
  count: number;
  pagination: ReturnType<typeof useFeaturePagination>;
}) {
  return (
    <TablePagination
      component="div"
      count={count}
      page={pagination.page}
      rowsPerPage={pagination.pageSize}
      rowsPerPageOptions={[5, 10, 20]}
      onPageChange={(_, page) => pagination.setPage(page)}
      onRowsPerPageChange={(event) => pagination.changePageSize(Number(event.target.value))}
      labelRowsPerPage="每页"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 共 ${count} 项`}
      getItemAriaLabel={(type) =>
        ({ first: "第一页", last: "最后一页", next: "下一页", previous: "上一页" })[type]
      }
      sx={{
        "& .MuiTablePagination-toolbar": { px: { xs: 0, sm: 1 }, flexWrap: "wrap" },
        "& .MuiTablePagination-spacer": { display: { xs: "none", sm: "block" } },
      }}
    />
  );
}
