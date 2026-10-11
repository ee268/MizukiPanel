import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { TypeScriptEditor } from "../components/TypeScriptEditor";
import type { SiteConfigDocument } from "../types";
import type { ConfigBackup } from "../../shared/config-backups";
import { ConfigIcon } from "./ConfigIcon";
import { ContentLoading } from "../components/ContentLoading";

interface ConfigEditorProps {
  document: SiteConfigDocument | null;
  initializer: string;
  busy: boolean;
  backingUp: boolean;
  backups: ConfigBackup[];
  onInitializerChange: (initializer: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onClear: () => void;
  onRestore: (id: string) => void;
}

export function ConfigEditor({
  document,
  initializer,
  busy,
  backingUp,
  backups,
  onInitializerChange,
  onSave,
  onDiscard,
  onClear,
  onRestore,
}: ConfigEditorProps) {
  const [backupId, setBackupId] = useState("");
  const [tab, setTab] = useState("edit");
  useEffect(() => setTab("edit"), [document?.descriptor.key]);
  useEffect(() => {
    if (!backups.some((entry) => entry.id === backupId)) setBackupId(backups[0]?.id ?? "");
  }, [backups, backupId]);
  if (!document)
    return (
      <ContentLoading
        heading="正在展开站点配置"
        description="正在准备配置内容与编辑区域"
        kind="settings"
      />
    );
  const dirty = initializer !== document.initializer;
  return (
    <Stack spacing={2.5} data-config-detail-layout="tabs">
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            variant="rounded"
            sx={(theme) => ({
              width: 60,
              height: 60,
              borderRadius: "18px",
              bgcolor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
              color: "primary.main",
            })}
          >
            <ConfigIcon configKey={document.descriptor.key} />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1">
              {document.descriptor.label}
            </Typography>
            <Typography color="text.secondary" sx={{ overflowWrap: "anywhere", mt: 0.5 }}>
              {document.descriptor.key} · {document.descriptor.group}
            </Typography>
          </Box>
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: "var(--mizuki-panel-font-mono)", mt: 0.5, overflowWrap: "anywhere" }}
        >
          {document.mode === "external"
            ? `overrides/${document.descriptor.key}.ts`
            : `src/config/${document.descriptor.file}`}
        </Typography>
        {document.warnings.map((warning) => (
          <Alert key={warning} severity="info" sx={{ mt: 2 }}>
            {warning}
          </Alert>
        ))}
      </Paper>
      <Tabs value={tab} onChange={(_, value: string) => setTab(value)} aria-label="配置详情分区">
        <Tab value="edit" label="配置编辑" id="config-edit-tab" aria-controls="config-edit-panel" />
        <Tab
          value="backups"
          label={`配置备份（${backups.length}）`}
          id="config-backups-tab"
          aria-controls="config-backups-panel"
        />
      </Tabs>
      <Paper
        data-config-save-bar
        variant="outlined"
        sx={{
          p: 1.5,
          borderRadius: 3,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ flexWrap: "wrap", alignItems: "center" }}
          useFlexGap
        >
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            onClick={onSave}
            disabled={document.readOnly || busy || backingUp || !dirty}
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
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: { sm: "auto !important" } }}
            aria-live="polite"
          >
            {backingUp ? "正在保留编辑前备份…" : dirty ? "有未保存修改" : "所有修改已保存"}
          </Typography>
        </Stack>
      </Paper>
      <Box sx={{ minWidth: 0 }}>
        <Paper
          id="config-edit-panel"
          role="tabpanel"
          aria-labelledby="config-edit-tab"
          hidden={tab !== "edit"}
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            minWidth: 0,
            display: tab !== "edit" ? "none" : "block",
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            编辑导出对象的 TypeScript
            内容。仅允许对象、数组、标量、枚举和标识符；函数调用及其他可执行表达式会被拒绝。
          </Typography>
          <TypeScriptEditor
            value={initializer}
            onChange={onInitializerChange}
            disabled={document.readOnly || busy}
          />
        </Paper>
        <Paper
          id="config-backups-panel"
          role="tabpanel"
          aria-labelledby="config-backups-tab"
          hidden={tab !== "backups"}
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            minWidth: 0,
            display: tab !== "backups" ? "none" : "block",
          }}
        >
          <Typography variant="h6">配置备份</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            仅保留当前配置的最近 5 份备份。恢复前也会备份当前内容。
          </Typography>
          {backups.length ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                <InputLabel id="config-backup-label">选择备份</InputLabel>
                <Select
                  labelId="config-backup-label"
                  label="选择备份"
                  value={backups.some((item) => item.id === backupId) ? backupId : ""}
                  onChange={(event) => setBackupId(event.target.value)}
                  disabled={busy || backingUp}
                >
                  {backups.map((entry, index) => (
                    <MenuItem key={entry.id} value={entry.id}>
                      {index + 1}. {new Date(entry.createdAt).toLocaleString()}
                      {!entry.targetExists ? " · 未设置覆盖" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                startIcon={<RestoreOutlined />}
                onClick={() => onRestore(backupId)}
                disabled={
                  document.readOnly ||
                  busy ||
                  backingUp ||
                  dirty ||
                  !backups.some((entry) => entry.id === backupId)
                }
              >
                恢复所选备份
              </Button>
            </Stack>
          ) : (
            <Typography color="text.secondary">尚无备份，开始修改时会自动保留。</Typography>
          )}
          {dirty && backups.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              请先保存或放弃当前编辑，再恢复备份。
            </Typography>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
