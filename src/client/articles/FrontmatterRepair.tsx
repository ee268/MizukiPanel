import { Alert, Box, Button, Stack, TextField } from "@mui/material";
import { splitArticleSource } from "../../lib/articles/article-source";
import { replaceFrontmatterYaml } from "./frontmatter-repair";

interface FrontmatterRepairProps {
  source: string;
  busy: boolean;
  readOnly: boolean;
  onChange: (source: string) => void;
  onSave: () => void;
}

export function FrontmatterRepair({
  source,
  busy,
  readOnly,
  onChange,
  onSave,
}: FrontmatterRepairProps) {
  const parts = splitArticleSource(source);
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        {!parts && (
          <Alert severity="info">
            未检测到完整 Frontmatter。填写 YAML 后会添加文章头部，原有内容作为正文保留。
          </Alert>
        )}
        <TextField
          label="Frontmatter YAML"
          multiline
          minRows={8}
          fullWidth
          value={parts?.yaml.replace(/\r?\n$/, "") ?? ""}
          disabled={busy || readOnly}
          onChange={(event) => onChange(replaceFrontmatterYaml(source, event.target.value))}
          slotProps={{ input: { sx: { fontFamily: "var(--mizuki-panel-font-mono)" } } }}
        />
        <Button
          variant="contained"
          sx={{ alignSelf: "flex-end" }}
          disabled={busy || readOnly}
          onClick={onSave}
        >
          保存 Frontmatter 修复
        </Button>
      </Stack>
    </Box>
  );
}
