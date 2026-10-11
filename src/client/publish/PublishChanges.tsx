import DifferenceOutlined from "@mui/icons-material/DifferenceOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
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
  onPush: () => void;
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
  onPush,
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
            从 Mizuki 项目工作区中选择文件，只提交勾选的修改。
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onChange={onToggleAll}
              disabled={disabled || !overview.canCommit}
            />
          }
          label="全选可提交文件"
        />
      </Stack>
      <Divider />

      {overview.changes.length ? (
        <List disablePadding sx={{ maxHeight: 440, overflow: "auto" }}>
          {overview.changes.map((change) => {
            const enabled = !disabled && overview.canCommit && !change.conflict && !change.staged;
            return (
              <ListItem
                key={`${change.status}-${change.path}`}
                disablePadding
                secondaryAction={
                  <Tooltip title="查看差异">
                    <IconButton
                      aria-label={`查看 ${change.path} 的差异`}
                      onClick={() => onShowDiff(change.path)}
                      disabled={change.conflict}
                    >
                      <DifferenceOutlined />
                    </IconButton>
                  </Tooltip>
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
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
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
                        {change.staged && <Chip size="small" label="已暂存" />}
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
            disabled={disabled}
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
            disabled={disabled}
            value={commitScope}
            onChange={(event) => onCommitScopeChange(event.target.value)}
            error={!validCommitScope(commitScope)}
            helperText="可留空；使用小写字母、数字及 . _ / -"
          />
        </Stack>
        <TextField
          label="提交说明"
          disabled={disabled}
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
            : "提交默认值记忆未开启；本次填写不会作为下次默认值。"}
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
            onClick={onPush}
            disabled={disabled || !overview.canPush}
          >
            推送当前分支
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {overview.pushDisabledReason ??
            `推送目标：${overview.branch} → ${overview.upstream}；包含已有提交，未提交文件不包含在内。`}
        </Typography>
      </Stack>
    </Paper>
  );
}
