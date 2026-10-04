import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { TypeScriptEditor } from "../components/TypeScriptEditor";
import type { SiteConfigDocument } from "../types";
import { ConfigValues } from "./ConfigValues";

interface ConfigEditorProps {
  document: SiteConfigDocument | null;
  initializer: string;
  tab: number;
  busy: boolean;
  backupPath: string | null;
  onInitializerChange: (initializer: string) => void;
  onTabChange: (tab: number) => void;
  onSave: () => void;
  onDiscard: () => void;
  onClear: () => void;
  onRestore: () => void;
}

export function ConfigEditor({
  document,
  initializer,
  tab,
  busy,
  backupPath,
  onInitializerChange,
  onTabChange,
  onSave,
  onDiscard,
  onClear,
  onRestore,
}: ConfigEditorProps) {
  if (!document) {
    return (
      <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5">{document.descriptor.label}</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontFamily: "var(--mizuki-panel-font-mono)", mt: 0.5 }}
            >
              {document.mode === "external"
                ? `overrides/${document.descriptor.key}.ts`
                : `src/config/${document.descriptor.file}`}
            </Typography>
          </Box>
          <Chip
            color={document.mode === "external" ? "info" : "default"}
            label={document.mode === "external" ? "独立仓库覆盖" : "本地源配置"}
          />
          <Chip
            color={document.changedPaths.length ? "warning" : "success"}
            label={`${document.changedPaths.length} 项差异`}
          />
        </Stack>
        {document.warnings.map((warning) => (
          <Alert key={warning} severity="info" sx={{ mt: 2 }}>
            {warning}
          </Alert>
        ))}
        <Tabs value={tab} onChange={(_, value: number) => onTabChange(value)} sx={{ mt: 2 }}>
          <Tab label="编辑" />
          <Tab label="默认 / 覆盖 / 最终" />
        </Tabs>
      </Paper>

      {tab === 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            编辑导出对象的 TypeScript
            内容。仅允许对象、数组、标量、枚举和标识符；函数调用及其他可执行表达式会被拒绝。
          </Typography>
          <TypeScriptEditor
            value={initializer}
            onChange={onInitializerChange}
            disabled={document.readOnly || busy}
          />
          <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: "wrap" }} useFlexGap>
            <Button
              variant="contained"
              startIcon={<SaveOutlined />}
              onClick={onSave}
              disabled={document.readOnly || busy || initializer === document.initializer}
            >
              保存配置
            </Button>
            <Button startIcon={<RefreshOutlined />} onClick={onDiscard} disabled={busy}>
              放弃编辑
            </Button>
            {document.mode === "external" && (
              <Button onClick={onClear} disabled={document.readOnly || busy}>
                清空覆盖
              </Button>
            )}
            {backupPath && (
              <Button
                color="warning"
                startIcon={<RestoreOutlined />}
                onClick={onRestore}
                disabled={busy}
              >
                撤销本次保存
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        <ConfigValues document={document} />
      )}
    </Stack>
  );
}
