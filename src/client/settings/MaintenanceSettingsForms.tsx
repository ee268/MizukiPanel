import { useMemo, useState } from "react";
import { Alert, FormControlLabel, Stack, Switch, TextField } from "@mui/material";
import { ScopedCard } from "./ScopedCard";
import type { useScopedSettings } from "./useScopedSettings";
import { SettingsModule } from "./SettingsModule";
import { ArchiveManagementPanel } from "./ArchiveManagementPanel";
export function MaintenanceSettingsForms({
  controller,
  active,
  revision,
  disabled,
  onRestored,
}: {
  controller: ReturnType<typeof useScopedSettings>;
  active: boolean;
  revision: unknown;
  disabled: boolean;
  onRestored: () => void;
}) {
  const [backupVisible, setBackupVisible] = useState(false),
    [trashVisible, setTrashVisible] = useState(false);
  const [backupRevision, setBackupRevision] = useState(0),
    [trashRevision, setTrashRevision] = useState(0);
  const backupKey = useMemo(() => [revision, backupRevision], [revision, backupRevision]);
  const trashKey = useMemo(() => [revision, trashRevision], [revision, trashRevision]);
  return (
    <Stack spacing={3}>
      <ScopedCard title="备份保留规则" controller={controller}>
        <Stack spacing={2}>
          <Alert severity="info">
            不会自动清理。以下规则只用于手动清理预览；每个原路径的最新备份和回收项始终保留，运行任务与无法确认归属的数据也受保护。
          </Alert>
          <FormControlLabel
            label="启用手动清理规则"
            control={
              <Switch
                checked={controller.value.enabled === true}
                onChange={(_, enabled) => controller.change({ enabled })}
              />
            }
          />
          <TextField
            label="保留天数"
            type="number"
            value={controller.value.days}
            onChange={(event) => controller.change({ days: Number(event.target.value) })}
            helperText="1—3650 天。早于保留期限的旧恢复项可进入清理预览。"
          />
          <TextField
            label="每个原路径保留数量"
            type="number"
            value={controller.value.count}
            onChange={(event) => controller.change({ count: Number(event.target.value) })}
            helperText="1—1000 个。超出数量的旧恢复项也可进入预览。"
          />
        </Stack>
      </ScopedCard>

      <SettingsModule label="备份管理" estimatedHeight={620} onVisibilityChange={setBackupVisible}>
        <ArchiveManagementPanel
          kind="backup"
          active={active && backupVisible}
          revision={backupKey}
          disabled={disabled}
          onRestored={onRestored}
          onChanged={() => setTrashRevision((value) => value + 1)}
        />
      </SettingsModule>
      <SettingsModule label="回收站" estimatedHeight={620} onVisibilityChange={setTrashVisible}>
        <ArchiveManagementPanel
          kind="trash"
          active={active && trashVisible}
          revision={trashKey}
          disabled={disabled}
          onRestored={onRestored}
          onChanged={() => setBackupRevision((value) => value + 1)}
        />
      </SettingsModule>
    </Stack>
  );
}
