import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import DifferenceOutlined from "@mui/icons-material/DifferenceOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { PublishOverview } from "../types";
import { statusLabel } from "./constants";
import type { PublishDialog } from "./usePublish";
import { commitTypes, validCommitScope } from "../../shared/task-settings";

interface PublishChangesProps {
  overview: PublishOverview;
  selected: string[];
  allSelected: boolean;
  commitMessage: string;
  commitType: string;
  commitScope: string;
  commitDescription: string;
  disabled: boolean;
  onToggle: (path: string) => void;
  onToggleAll: () => void;
  onCommitTypeChange: (value: string) => void;
  onCommitScopeChange: (value: string) => void;
  onCommitDescriptionChange: (value: string) => void;
  onShowDiff: (path: string) => void;
  onCommit: () => void;
  onOpenDialog: (dialog: PublishDialog) => void;
}

export function PublishChanges({
  overview,
  selected,
  allSelected,
  commitMessage,
  commitType,
  commitScope,
  commitDescription,
  disabled,
  onToggle,
  onToggleAll,
  onCommitTypeChange,
  onCommitScopeChange,
  onCommitDescriptionChange,
  onShowDiff,
  onCommit,
  onOpenDialog,
}: PublishChangesProps) {
  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ p: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6">选择提交内容</Typography>
          <Typography variant="body2" color="text.secondary">
            只会暂存并提交勾选的受管理文件。
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onChange={onToggleAll}
            />
          }
          label="全选可发布项"
        />
      </Stack>
      <Divider />

      {overview.changes.length ? (
        <List disablePadding>
          {overview.changes.map((change) => {
            const enabled = change.managed && !change.conflict && !change.staged;
            return (
              <ListItem
                key={`${change.status}-${change.path}`}
                disablePadding
                secondaryAction={
                  change.managed && (
                    <Tooltip title="查看差异">
                      <IconButton onClick={() => onShowDiff(change.path)}>
                        <DifferenceOutlined />
                      </IconButton>
                    </Tooltip>
                  )
                }
              >
                <ListItemButton
                  disabled={!enabled}
                  onClick={() => enabled && onToggle(change.path)}
                  sx={{ pr: 7 }}
                >
                  <Checkbox
                    edge="start"
                    checked={selected.includes(change.path)}
                    disabled={!enabled}
                    tabIndex={-1}
                  />
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography
                          component="span"
                          sx={{
                            fontFamily: "var(--mizuki-panel-font-mono)",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {change.path}
                        </Typography>
                        <Chip
                          size="small"
                          label={statusLabel(change)}
                          color={change.conflict ? "error" : "default"}
                        />
                        {!change.managed && <Chip size="small" label="不属于管理范围" />}
                      </Stack>
                    }
                    secondary={change.originalPath ? `原路径：${change.originalPath}` : undefined}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Box sx={{ p: 3 }}>
          <Typography color="text.secondary">没有检测到工作树变更。</Typography>
        </Box>
      )}

      <Divider />
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            fullWidth
            select
            label="提交类型"
            value={commitType}
            onChange={(event) => onCommitTypeChange(event.target.value)}
          >
            {commitTypes.map((type) => (
              <MenuItem value={type} key={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="提交作用域"
            value={commitScope}
            onChange={(event) => onCommitScopeChange(event.target.value)}
            error={!validCommitScope(commitScope)}
            helperText="可留空；使用小写字母、数字及 . _ / -"
          />
        </Stack>
        <TextField
          label="提交说明"
          value={commitDescription}
          onChange={(event) => onCommitDescriptionChange(event.target.value)}
          helperText="填写本次变更说明；类型和作用域会自动组成 Conventional Commit。正文不记忆。"
          multiline
          minRows={2}
          fullWidth
        />
        <Typography
          sx={{
            fontFamily: "var(--mizuki-panel-font-mono)",
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          }}
        >
          提交预览：{commitMessage}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {overview.preferences?.remember
            ? "提交成功后记住类型与作用域；文件勾选和正文不保存为默认值。"
            : "发布默认值记忆未开启；本次填写不会作为下次默认值。"}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            onClick={onCommit}
            disabled={
              disabled ||
              !overview.canCommit ||
              !selected.length ||
              !commitDescription.trim() ||
              !validCommitScope(commitScope)
            }
          >
            提交所选文件
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUploadOutlined />}
            onClick={() => onOpenDialog("push")}
            disabled={disabled || !overview.canPush}
          >
            推送当前分支
          </Button>
          <Button
            color="warning"
            variant="text"
            startIcon={<RestoreOutlined />}
            onClick={() => onOpenDialog("revert")}
            disabled={disabled}
          >
            还原面板提交
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
