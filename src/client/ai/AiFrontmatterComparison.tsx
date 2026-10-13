import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { FrontmatterEntry } from "../../shared/article";
import type { AiFrontmatterChange } from "../../shared/ai-frontmatter";
export function AiFrontmatterComparison({
  before,
  changes,
}: {
  before: FrontmatterEntry[];
  changes: AiFrontmatterChange[];
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
      <Table
        size="small"
        stickyHeader
        aria-label="Frontmatter 字段修改对比"
        sx={{
          tableLayout: "fixed",
          "& td, & th": { overflowWrap: "anywhere", verticalAlign: "top", px: 1 },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: "28%" }}>字段</TableCell>
            <TableCell>修改前</TableCell>
            <TableCell>修改后</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {changes.map((change) => {
            const previous = before.find((e) => e.key === change.key);
            return (
              <TableRow key={change.key}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {change.key}
                  </Typography>
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: previous ? "text.primary" : "text.secondary",
                  }}
                >
                  {previous?.value ?? "未设置"}
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: change.value === null ? "error.main" : "text.primary",
                    bgcolor: change.value === null ? "action.hover" : "action.selected",
                  }}
                >
                  {change.value === null ? "删除字段" : change.value || "空字符串"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
